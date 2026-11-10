/** Обёртки над Steam Web API. */
import { HAS_STEAM, STEAM_KEY } from './config.mjs';
import { UserInputError } from './errors.mjs';
import { getJson } from './http.mjs';
import { assertSteamId64 } from './steamid.mjs';

const API = 'https://api.steampowered.com';
const CS2_APP_ID = 730;

export function steamKeyRequired() {
  if (!HAS_STEAM) {
    throw new UserInputError(
      'Не задан STEAM_API_KEY',
      'Добавьте ключ в .env — без него Steam не отдаёт профиль и библиотеку игр.',
    );
  }
}

/** Ник из ссылки steamcommunity.com/id/<vanity> -> steamID64. */
export async function resolveVanity(vanity) {
  steamKeyRequired();
  const url = `${API}/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_KEY}&vanityurl=${encodeURIComponent(vanity)}`;
  const data = await getJson(url, { service: 'steam' });
  const response = data?.response;

  if (!response || response.success !== 1 || !response.steamid) {
    throw new UserInputError(
      `Профиль Steam «${vanity}» не найден`,
      'Проверьте ник или вставьте прямую ссылку вида steamcommunity.com/profiles/7656…',
    );
  }

  return assertSteamId64(response.steamid);
}

export async function getPlayerSummary(steamId64) {
  steamKeyRequired();
  const url = `${API}/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_KEY}&steamids=${steamId64}`;
  const data = await getJson(url, { service: 'steam' });
  const player = data?.response?.players?.[0];
  if (!player) return null;

  return {
    steamId64: player.steamid,
    personaName: player.personaname ?? null,
    avatar: player.avatarfull ?? player.avatarmedium ?? player.avatar ?? null,
    profileUrl: player.profileurl ?? `https://steamcommunity.com/profiles/${player.steamid}`,
    countryCode: player.loccountrycode ?? null,
    createdAt: player.timecreated ? new Date(player.timecreated * 1000).toISOString() : null,
    visibility: player.communityvisibilitystate === 3 ? 'public' : 'private',
    isOnline: player.personastate > 0,
  };
}

/**
 * Есть ли CS2 в библиотеке.
 *
 * `null` означает «не знаем»: закрытый профиль или скрытые детали игр.
 * Это не ошибка, а честный ответ — UI так и показывает.
 */
export async function ownsCs2(steamId64) {
  if (!HAS_STEAM) return null;
  const url =
    `${API}/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}` +
    `&steamid=${steamId64}&include_appinfo=0&include_played_free_games=1`;

  try {
    const data = await getJson(url, { service: 'steam' });
    const games = data?.response?.games;
    if (!Array.isArray(games) || games.length === 0) return null;
    return games.some((game) => game.appid === CS2_APP_ID);
  } catch {
    return null;
  }
}
