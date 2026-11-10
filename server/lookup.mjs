/** Сборка единого ответа /api/lookup из Steam и FACEIT. */
import { HAS_FACEIT, HAS_STEAM, MATCH_LIMIT } from './config.mjs';
import { demoLookup } from './demo.mjs';
import { UpstreamError, UserInputError } from './errors.mjs';
import {
  findBySteamId,
  getHistory,
  getLifetime,
  getMatchDetail,
  normalizeMatch,
  normalizeMatchStats,
} from './faceit.mjs';
import { getPlayerSummary, ownsCs2, resolveVanity } from './steam.mjs';
import { parseSteamInput } from './steamid.mjs';
import { cached, mapLimit, TTL } from './util.mjs';

export async function buildLookup({ q, limit = MATCH_LIMIT, demo = false }) {
  const query = String(q ?? '').trim();
  if (!query) throw new UserInputError('Введите Steam ID или ссылку на профиль');

  // Проверяем формат ввода и в демо-режиме тоже: поведение должно совпадать.
  const parsed = parseSteamInput(query);

  if (demo) return demoLookup(query, limit);

  const warnings = [];

  const steamId64 = parsed.steamId64 ?? (await resolveVanity(parsed.vanity));

  const [steamResult, faceitResult] = await Promise.all([
    loadSteam(steamId64, warnings),
    loadFaceit(steamId64, limit, warnings),
  ]);

  return {
    demo: false,
    fetchedAt: new Date().toISOString(),
    query,
    steamId64,
    steam: steamResult.steam,
    faceit: faceitResult.faceit,
    lifetime: faceitResult.lifetime,
    matches: faceitResult.matches,
    warnings: dedupe(warnings),
  };
}

async function loadSteam(steamId64, warnings) {
  if (!HAS_STEAM) {
    warnings.push('STEAM_API_KEY не задан: ник, аватар и библиотека Steam недоступны.');
    return { steam: { steamId64, personaName: null } };
  }

  try {
    const [summary, owned] = await Promise.all([
      cached(`steam:summary:${steamId64}`, TTL.steamProfile, () => getPlayerSummary(steamId64)),
      cached(`steam:cs2:${steamId64}`, TTL.steamGames, () => ownsCs2(steamId64)),
    ]);

    if (!summary) {
      warnings.push('Steam не вернул данные профиля — проверьте, что steamID64 существует.');
      return { steam: { steamId64, personaName: null } };
    }

    if (owned === null) {
      warnings.push(
        summary.visibility === 'private'
          ? 'Профиль Steam закрыт: наличие CS2 проверить нельзя.'
          : 'Детали игр в Steam скрыты: наличие CS2 проверить нельзя.',
      );
    }

    return { steam: { ...summary, cs2Owned: owned } };
  } catch (err) {
    warnings.push(`Steam недоступен (${describe(err)}). Профиль показан без данных Steam.`);
    return { steam: { steamId64, personaName: null } };
  }
}

async function loadFaceit(steamId64, limit, warnings) {
  if (!HAS_FACEIT) {
    warnings.push('FACEIT_API_KEY не задан: привязка FACEIT не проверяется.');
    return { faceit: { linked: null, reason: 'no_key' }, lifetime: null, matches: [] };
  }

  let player;
  try {
    player = await cached(`faceit:link:${steamId64}`, TTL.faceitLink, () => findBySteamId(steamId64));
  } catch (err) {
    warnings.push(describeFaceitError(err));
    return { faceit: { linked: null, reason: 'error' }, lifetime: null, matches: [] };
  }

  if (!player) {
    return { faceit: { linked: false }, lifetime: null, matches: [] };
  }

  const [lifetime, history] = await Promise.all([
    cached(`faceit:lifetime:${player.playerId}:${player.game}`, TTL.faceitLifetime, () =>
      getLifetime(player.playerId, player.game),
    ).catch(() => null),
    cached(`faceit:history:${player.playerId}:${player.game}:${limit}`, TTL.faceitHistory, () =>
      getHistory(player.playerId, limit, player.game),
    ).catch(() => []),
  ]);

  const matches = (Array.isArray(history) ? history : []).map((item) => normalizeMatch(item, player.playerId));

  return { faceit: player, lifetime, matches: await enrichMatches(matches, player.playerId) };
}

/** Догружаем карту и K/D/A по каждому матчу — умеренно параллельно и с кэшем на сутки. */
async function enrichMatches(matches, playerId) {
  if (matches.length === 0) return matches;

  const details = await mapLimit(matches, 4, (match) =>
    cached(`faceit:match:${match.matchId}`, TTL.faceitMatch, () => getMatchDetail(match.matchId)).then((detail) =>
      normalizeMatchStats(detail, playerId),
    ),
  );

  return matches.map((match, index) => ({ ...match, ...(details[index] ?? {}) }));
}

function describe(err) {
  if (err instanceof UpstreamError) return err.status === 0 ? 'таймаут' : `код ${err.status}`;
  return 'неизвестная ошибка';
}

function describeFaceitError(err) {
  if (err instanceof UpstreamError) {
    if (err.status === 401 || err.status === 403) {
      return 'FACEIT отклонил ключ (401/403): проверьте FACEIT_API_KEY и права приложения.';
    }
    if (err.status === 429) return 'FACEIT временно ограничил запросы (429) — попробуйте через минуту.';
    if (err.status === 0) return 'FACEIT не ответил вовремя — попробуйте ещё раз.';
  }
  return 'FACEIT недоступен, попробуйте позже.';
}

function dedupe(items) {
  return [...new Set(items)];
}
