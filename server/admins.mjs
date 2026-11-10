/** Админы админки: владелец из окружения + те, кого он добавил. */
import { randomUUID } from 'node:crypto';

import { hashPassword, ownerLogin, ownerPassword } from './auth.mjs';
import { getMode, getPool, withJsonFile } from './db.mjs';

const COLUMNS = 'id, login, password_hash, role, created_at, last_login_at';

export async function initAdmins() {
  const pool = getPool();

  if (getMode() === 'postgres' && pool) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        login TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login_at TIMESTAMPTZ
      )
    `);
  }

  if (ownerPassword) {
    await ensureOwner({ login: ownerLogin, password: ownerPassword });
  }
}

/** Владелец всегда перезаписывается из окружения — пароль меняется через env. */
export async function ensureOwner({ login, password }) {
  const passwordHash = hashPassword(password);
  const pool = getPool();

  if (getMode() === 'postgres' && pool) {
    await pool.query(
      `INSERT INTO admins (id, login, password_hash, role)
       VALUES ($1, $2, $3, 'owner')
       ON CONFLICT (login) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'owner'`,
      [randomUUID(), login, passwordHash],
    );
    return;
  }

  await withJsonFile('admins', (items) => {
    const existing = items.find((item) => item.login === login);
    if (existing) {
      existing.password_hash = passwordHash;
      existing.role = 'owner';
    } else {
      items.push({
        id: randomUUID(),
        login,
        password_hash: passwordHash,
        role: 'owner',
        created_at: new Date().toISOString(),
        last_login_at: null,
      });
    }
    return { save: true };
  });
}

export async function findAdminByLogin(login) {
  const normalized = String(login ?? '').trim().toLowerCase();
  const pool = getPool();

  if (getMode() === 'postgres' && pool) {
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM admins WHERE login = $1`, [normalized]);
    return rows[0] ?? null;
  }

  return withJsonFile('admins', (items) => ({
    result: items.find((item) => item.login === normalized) ?? null,
  }));
}

export async function findAdminById(id) {
  const pool = getPool();

  if (getMode() === 'postgres' && pool) {
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM admins WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  return withJsonFile('admins', (items) => ({
    result: items.find((item) => item.id === id) ?? null,
  }));
}

export async function listAdmins() {
  const pool = getPool();

  if (getMode() === 'postgres' && pool) {
    const { rows } = await pool.query(
      `SELECT id, login, role, created_at, last_login_at FROM admins ORDER BY role DESC, created_at ASC`,
    );
    return rows;
  }

  return withJsonFile('admins', (items) => ({
    result: items
      .map(({ password_hash: _ignored, ...rest }) => rest)
      .sort((a, b) => (a.role === b.role ? String(a.created_at).localeCompare(String(b.created_at)) : a.role === 'owner' ? -1 : 1)),
  }));
}

export async function createAdmin({ login, password }) {
  const normalized = String(login ?? '').trim().toLowerCase();
  const passwordHash = hashPassword(password);
  const pool = getPool();

  if (getMode() === 'postgres' && pool) {
    try {
      await pool.query(
        `INSERT INTO admins (id, login, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
        [randomUUID(), normalized, passwordHash],
      );
      return { ok: true };
    } catch (err) {
      if (err.code === '23505') return { ok: false, taken: true };
      throw err;
    }
  }

  return withJsonFile('admins', (items) => {
    if (items.some((item) => item.login === normalized)) return { result: { ok: false, taken: true } };

    items.push({
      id: randomUUID(),
      login: normalized,
      password_hash: passwordHash,
      role: 'admin',
      created_at: new Date().toISOString(),
      last_login_at: null,
    });

    return { result: { ok: true }, save: true };
  });
}

/** Владельца удалить нельзя — иначе можно потерять доступ навсегда. */
export async function deleteAdmin(id) {
  const admin = await findAdminById(id);
  if (!admin) return { ok: false, missing: true };
  if (admin.role === 'owner') return { ok: false, owner: true };

  const pool = getPool();

  if (getMode() === 'postgres' && pool) {
    await pool.query('DELETE FROM admins WHERE id = $1', [id]);
    return { ok: true };
  }

  await withJsonFile('admins', (items) => {
    const index = items.findIndex((item) => item.id === id);
    if (index !== -1) items.splice(index, 1);
    return { save: true };
  });

  return { ok: true };
}

export async function touchAdmin(id) {
  const pool = getPool();

  if (getMode() === 'postgres' && pool) {
    await pool.query('UPDATE admins SET last_login_at = now() WHERE id = $1', [id]);
    return;
  }

  await withJsonFile('admins', (items) => {
    const admin = items.find((item) => item.id === id);
    if (admin) admin.last_login_at = new Date().toISOString();
    return { save: Boolean(admin) };
  });
}
