const PREFIX = 'cs-faceit:reported:';

/** Поставил ли этот браузер жалобу на игрока (чтобы кнопка не предлагала повтор). */
export function hasReported(steamId64: string): boolean {
  try {
    return localStorage.getItem(PREFIX + steamId64) === '1';
  } catch {
    return false;
  }
}

export function markReported(steamId64: string): void {
  try {
    localStorage.setItem(PREFIX + steamId64, '1');
  } catch {
    /* приватный режим — просто не запомним */
  }
}
