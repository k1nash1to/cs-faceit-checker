/**
 * Разбор пользовательского ввода в Steam ID.
 *
 * Поддерживаем всё, что люди реально копируют из Steam и сторонних сайтов:
 *   - ссылку  https://steamcommunity.com/profiles/76561198000000000
 *   - ссылку  https://steamcommunity.com/id/s1mple
 *   - steamID64 (17 цифр)
 *   - STEAM_1:0:1234567
 *   - [U:1:1234567]
 *   - короткий account id
 */
import { UserInputError } from './errors.mjs';

const STEAM64_BASE = 76561197960265728n;

export function parseSteamInput(raw) {
  const input = String(raw ?? '').trim();
  if (!input) {
    throw new UserInputError('Введите Steam ID или ссылку на профиль');
  }

  // Ссылка на профиль
  const url = input.match(/steamcommunity\.com\/(profiles|id)\/([^/?#\s]+)/i);
  if (url) {
    const [, kind, value] = url;
    if (kind.toLowerCase() === 'profiles') return { steamId64: assertSteamId64(value) };
    return { vanity: decodeURIComponent(value) };
  }

  // [U:1:123456]
  const universe = input.match(/^\[?U:1:(\d+)\]?$/i);
  if (universe) return { steamId64: fromAccountId(BigInt(universe[1])) };

  // STEAM_1:0:123456
  const legacy = input.match(/^STEAM_[0-5]:([01]):(\d+)$/i);
  if (legacy) {
    const accountId = BigInt(legacy[2]) * 2n + BigInt(legacy[1]);
    return { steamId64: fromAccountId(accountId) };
  }

  // steamID64
  if (/^\d{17}$/.test(input)) return { steamId64: assertSteamId64(input) };

  // Короткий account id (например, 123456789) — часто копируют из сторонних сервисов
  if (/^\d{1,10}$/.test(input)) return { steamId64: fromAccountId(BigInt(input)) };

  // Остальное считаем vanity-именем из ссылки /id/<ник>
  if (/^[a-zA-Z0-9_.-]{2,32}$/.test(input)) return { vanity: input };

  throw new UserInputError(
    'Не удалось распознать Steam ID',
    'Подойдёт ссылка на профиль, steamID64 (17 цифр) или ник из ссылки steamcommunity.com/id/…',
  );
}

function fromAccountId(accountId) {
  return (STEAM64_BASE + accountId).toString();
}

export function assertSteamId64(value) {
  const id = String(value ?? '');
  if (!/^\d{17}$/.test(id) || !id.startsWith('7656119')) {
    throw new UserInputError(
      'Это не похоже на steamID64',
      'steamID64 начинается с 7656119 и состоит из 17 цифр. Можно вставить и обычную ссылку на профиль.',
    );
  }
  return id;
}
