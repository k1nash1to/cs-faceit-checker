const MAP_NAMES: Record<string, string> = {
  de_mirage: 'Mirage',
  de_dust2: 'Dust II',
  de_inferno: 'Inferno',
  de_ancient: 'Ancient',
  de_anubis: 'Anubis',
  de_nuke: 'Nuke',
  de_vertigo: 'Vertigo',
  de_overpass: 'Overpass',
  de_train: 'Train',
  de_cache: 'Cache',
  de_cbble: 'Cobblestone',
  de_tuscan: 'Tuscan',
};

export function mapName(map?: string | null): string {
  if (!map) return '—';
  return MAP_NAMES[map] ?? map.replace(/^de_/, '').replace(/^./, (char) => char.toUpperCase());
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const rtf = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' });
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);

  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  return rtf.format(Math.round(days / 30), 'month');
}

export function number(value?: number | null, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function percent(value?: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${number(value, 1)}%`;
}

export function countryFlag(code?: string | null): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...code.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0)));
}
