/**
 * Обёртки над FACEIT Data API v4.
 *
 * Проверено на живом API, структуры такие:
 *   GET /players?game=cs2&game_player_id=<steamID64>  -> профиль или 404
 *   GET /players/{id}/stats/cs2                       -> { lifetime: {...}, segments: [{ stats }] }
 *   GET /players/{id}/history?game=cs2                -> { items: [{ teams, results, ... }] }
 *   GET /matches/{id}/stats                           -> { rounds: [{ round_stats, teams[].players[].player_stats }] }
 *
 * CS2 пришёл на смену CS:GO, и у части старых аккаунтов игра до сих пор
 * числится как `csgo`, поэтому сначала пробуем `cs2`, потом `csgo`.
 */
import { FACEIT_KEY } from './config.mjs';
import { UpstreamError } from './errors.mjs';
import { getJson } from './http.mjs';

const API = 'https://open.faceit.com/data/v4';

const authHeaders = () => ({ Authorization: `Bearer ${FACEIT_KEY}` });

const toInt = (value) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : null;
};

const toNum = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseFloat(String(value).replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Привязка Steam -> FACEIT. null = аккаунт не привязан. */
export async function findBySteamId(steamId64) {
  for (const game of ['cs2', 'csgo']) {
    try {
      const data = await getJson(
        `${API}/players?game=${game}&game_player_id=${encodeURIComponent(steamId64)}`,
        { headers: authHeaders(), service: 'faceit' },
      );
      if (data?.player_id) return normalizePlayer(data, game);
      return null;
    } catch (err) {
      if (err instanceof UpstreamError && err.status === 404) continue;
      throw err;
    }
  }
  return null;
}

export function normalizePlayer(raw, game) {
  const games = raw.games ?? {};
  const gameData = games[game] ?? games.cs2 ?? games.csgo ?? {};

  return {
    linked: true,
    game,
    playerId: raw.player_id,
    nickname: raw.nickname ?? null,
    avatar: raw.avatar ?? null,
    country: raw.country ?? null,
    region: gameData.region ?? null,
    elo: toInt(gameData.faceit_elo),
    level: toInt(gameData.skill_level),
    steamNickname: gameData.game_player_name ?? null,
    faceitUrl: raw.nickname
      ? `https://www.faceit.com/en/players/${encodeURIComponent(raw.nickname)}`
      : 'https://www.faceit.com/',
  };
}

/**
 * Пожизненная статистика.
 *
 * В `lifetime` лежат и суммы, и средние: `K/D Ratio` — это сумма отношений
 * по матчам (8102.95), а нужное среднее — `Average K/D Ratio`. Так же с
 * хедшотами. Мультикиллы и MVP есть только в разбивке по картам — суммируем.
 */
export async function getLifetime(playerId, game = 'cs2') {
  const data = await getJson(`${API}/players/${encodeURIComponent(playerId)}/stats/${game}`, {
    headers: authHeaders(),
    service: 'faceit',
  });

  const lifetime = data?.lifetime;
  if (!lifetime) return null;

  const segments = Array.isArray(data?.segments) ? data.segments : [];
  const sumOverMaps = (key) => {
    let total = null;
    for (const segment of segments) {
      const value = toNum(segment?.stats?.[key]);
      if (value !== null) total = (total ?? 0) + value;
    }
    return total;
  };

  const matches = toNum(lifetime['Matches']);
  const wins = toNum(lifetime['Wins']);
  const winRate = toNum(lifetime['Win Rate %']);

  return {
    label: 'Lifetime',
    matches,
    wins,
    winRate: winRate ?? (matches && wins !== null ? round((wins / matches) * 100, 1) : null),
    kd: toNum(lifetime['Average K/D Ratio']),
    adr: toNum(lifetime['ADR']),
    hsPercent: toNum(lifetime['Average Headshots %']),
    mvps: sumOverMaps('MVPs'),
    tripleKills: sumOverMaps('Triple Kills'),
    quadroKills: sumOverMaps('Quadro Kills'),
    pentaKills: sumOverMaps('Penta Kills'),
    winStreak: toNum(lifetime['Current Win Streak']),
    longestStreak: toNum(lifetime['Longest Win Streak']),
  };
}

/** Последние матчи (без деталей: карта и K/D/A подтягиваются отдельно). */
export async function getHistory(playerId, limit, game = 'cs2') {
  const data = await getJson(
    `${API}/players/${encodeURIComponent(playerId)}/history?game=${game}&offset=0&limit=${limit}`,
    { headers: authHeaders(), service: 'faceit' },
  );
  return Array.isArray(data?.items) ? data.items : [];
}

export async function getMatchDetail(matchId) {
  return getJson(`${API}/matches/${encodeURIComponent(matchId)}/stats`, {
    headers: authHeaders(),
    service: 'faceit',
  });
}

/**
 * Приводим элемент истории к плоскому виду.
 *
 * Составы лежат в `teams.faction1.players` (массив id), а не в `factions.roster`.
 * `playing_players` содержит всех десятерых и на роль не годится.
 */
export function normalizeMatch(item, playerId) {
  const teams = item?.teams ?? {};
  const myKey =
    ['faction1', 'faction2'].find((key) => {
      const players = teams[key]?.players ?? [];
      return players.some((player) => (typeof player === 'string' ? player : player?.player_id) === playerId);
    }) ?? null;

  const score = item?.results?.score ?? {};
  const enemyKey = myKey === 'faction1' ? 'faction2' : 'faction1';
  const myScore = myKey ? toInt(score[myKey]) : null;
  const enemyScore = myKey ? toInt(score[enemyKey]) : null;
  const winner = item?.results?.winner ?? null;
  const startedAtRaw = Number(item?.started_at);
  const rawUrl = item?.faceit_url ?? null;

  return {
    matchId: item?.match_id ?? null,
    startedAt: Number.isFinite(startedAtRaw) ? new Date(startedAtRaw * 1000).toISOString() : null,
    competition: item?.competition_name ?? null,
    gameMode: item?.game_mode ?? null,
    region: item?.region ?? null,
    result: myKey && winner ? (winner === myKey ? 'win' : 'loss') : null,
    score: myScore !== null && enemyScore !== null ? `${myScore} : ${enemyScore}` : null,
    faceitUrl: rawUrl
      ? rawUrl.replace('{lang}', 'en')
      : item?.match_id
        ? `https://www.faceit.com/en/cs2/room/${item.match_id}`
        : null,
    map: null,
    kills: null,
    deaths: null,
    assists: null,
    kd: null,
    hsPercent: null,
    mvps: null,
  };
}

/** Карта и статистика игрока из /matches/{id}/stats. */
export function normalizeMatchStats(detail, playerId) {
  const rounds = Array.isArray(detail?.rounds) ? detail.rounds : [];
  if (rounds.length === 0) return null;

  const map = rounds[0]?.round_stats?.Map ?? null;
  let stats = null;

  for (const round of rounds) {
    for (const team of round?.teams ?? []) {
      for (const player of team?.players ?? []) {
        if (player?.player_id === playerId) stats = player.player_stats ?? null;
      }
    }
  }

  if (!stats) return { map };

  return {
    map,
    kills: toInt(stats.Kills),
    deaths: toInt(stats.Deaths),
    assists: toInt(stats.Assists),
    kd: toNum(stats['K/D Ratio']),
    hsPercent: toNum(stats['Headshots %']),
    mvps: toInt(stats.MVPs),
  };
}
