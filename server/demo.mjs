/**
 * Демо-данные.
 *
 * Нужны, чтобы сайт можно было открыть и оценить без ключей Steam/FACEIT:
 * весь UI, состояния и вёрстка проверяются на реалистичном ответе.
 * Показываются только при отсутствии ключей или при DEMO=1.
 */

const svgAvatar = (letter, from, to) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
      `</linearGradient></defs>` +
      `<rect width="128" height="128" fill="url(#g)"/>` +
      `<text x="64" y="86" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700" ` +
      `fill="rgba(8,11,16,0.72)" text-anchor="middle">${letter}</text></svg>`,
  )}`;

const MAPS = ['de_mirage', 'de_dust2', 'de_inferno', 'de_ancient', 'de_anubis', 'de_nuke'];
const COMPETITIONS = ['5v5 Ranked', '5v5 Ranked', 'Premium', '5v5 Ranked'];
const SCORES = ['13 : 9', '11 : 13', '13 : 7', '16 : 14', '9 : 13', '13 : 5', '14 : 16', '13 : 10', '13 : 11', '7 : 13', '13 : 8', '13 : 4'];
const RESULTS = ['win', 'loss', 'win', 'win', 'loss', 'win', 'loss', 'win', 'win', 'loss', 'win', 'win'];
const KDA = [
  [24, 17, 6], [18, 20, 4], [27, 12, 9], [22, 19, 5], [15, 21, 3], [26, 11, 7],
  [19, 22, 6], [23, 16, 8], [21, 18, 4], [16, 20, 5], [25, 14, 7], [28, 13, 10],
];

const DAY = 24 * 60 * 60 * 1000;

export function demoLookup(query, limit) {
  const cleaned = String(query ?? '').trim();
  const fromUrl = cleaned.match(/steamcommunity\.com\/(?:id|profiles)\/([^/?#\s]+)/i);
  const base = fromUrl ? decodeURIComponent(fromUrl[1]) : cleaned;
  const name = /^\d+$/.test(base) || base.length === 0 ? 'PlayerOne' : base.slice(0, 24);
  const letter = name.slice(0, 1).toUpperCase() || 'P';
  const steamId64 = '76561198012345678';
  const now = Date.now();
  const count = Math.max(1, Math.min(limit, SCORES.length));

  const matches = Array.from({ length: count }, (_, i) => {
    const [kills, deaths, assists] = KDA[i % KDA.length];
    return {
      matchId: `1-${(i + 1).toString(16).padStart(8, '0')}-demo-${i}`,
      startedAt: new Date(now - (i * 2.4 + 0.6) * DAY).toISOString(),
      competition: COMPETITIONS[i % COMPETITIONS.length],
      gameMode: '5v5',
      region: 'EU',
      result: RESULTS[i % RESULTS.length],
      score: SCORES[i % SCORES.length],
      faceitUrl: 'https://www.faceit.com/en/cs2',
      map: MAPS[i % MAPS.length],
      kills,
      deaths,
      assists,
      kd: Math.round((kills / Math.max(1, deaths)) * 100) / 100,
      hsPercent: 44 + ((i * 7) % 18),
      mvps: 2 + (i % 5),
    };
  });

  return {
    demo: true,
    fetchedAt: new Date().toISOString(),
    query: cleaned || name,
    steamId64,
    steam: {
      steamId64,
      personaName: name,
      avatar: svgAvatar(letter, '#ffb26b', '#ff6a3d'),
      profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
      countryCode: 'UA',
      createdAt: '2014-05-17T09:41:00.000Z',
      visibility: 'public',
      isOnline: true,
      cs2Owned: true,
    },
    faceit: {
      linked: true,
      game: 'cs2',
      playerId: '9f1c2b3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
      nickname: name,
      avatar: svgAvatar(letter, '#ff8a3d', '#ff3d6e'),
      country: 'ua',
      region: 'EU',
      elo: 1834,
      level: 7,
      steamNickname: name,
      faceitUrl: `https://www.faceit.com/en/players/${encodeURIComponent(name)}`,
    },
    lifetime: {
      label: 'Lifetime',
      matches: 486,
      wins: 268,
      winRate: 55.1,
      kd: 1.18,
      adr: 84.3,
      hsPercent: 53.2,
      mvps: 3121,
      tripleKills: 258,
      quadroKills: 44,
      pentaKills: 7,
      winStreak: 3,
      longestStreak: 11,
    },
    matches,
    warnings: [
      'Демо-режим: ключи STEAM_API_KEY и FACEIT_API_KEY не заданы, показаны тестовые данные.',
    ],
  };
}
