/**
 * Пароли, сессии и cookie для админки.
 *
 * Пароли — scrypt со случайной солью. Сессия — подписанный HMAC cookie,
 * поэтому в базе не нужно хранить токены сессий.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import { ADMIN_LOGIN, ADMIN_PASSWORD, ADMIN_TOKEN, SESSION_SECRET } from './config.mjs';

const KEYLEN = 64;
const SESSION_COOKIE = 'cs_admin';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Логин владельца: ADMIN_PASSWORD, иначе старый ADMIN_TOKEN как пароль. */
export const ownerLogin = (ADMIN_LOGIN || 'admin').toLowerCase();
export const ownerPassword = ADMIN_PASSWORD || ADMIN_TOKEN || '';
export const authEnabled = ownerPassword.length > 0;

const secret =
  SESSION_SECRET ||
  createHmac('sha256', 'cs-faceit-checker-session').update(ownerPassword || 'disabled').digest('hex');

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;

  const computed = scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  if (computed.length !== expected.length) return false;

  return timingSafeEqual(computed, expected);
}

const sign = (payload) => createHmac('sha256', secret).update(payload).digest('base64url');

export function createSession(admin) {
  const payload = Buffer.from(
    JSON.stringify({ sub: admin.id, login: admin.login, role: admin.role, exp: Date.now() + SESSION_TTL_MS }),
  ).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

export function readSession(value) {
  const [payload, signature] = String(value ?? '').split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  if (expected.length !== signature.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const result = {};

  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }

  return result;
}

export const cookieName = SESSION_COOKIE;

export function sessionCookie(token, secure) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export const clearSessionCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
