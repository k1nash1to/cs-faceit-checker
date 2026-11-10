/** Бейдж для форумов и подписей: маленький SVG со ссылкой на профиль. */
const LEVEL_COLORS = {
  1: '#98a2b3',
  2: '#3ecf8e',
  3: '#3ecf8e',
  4: '#ffd166',
  5: '#ffd166',
  6: '#ffb020',
  7: '#ff8a3d',
  8: '#ff6b3d',
  9: '#ff5f6d',
  10: '#ff3b4e',
};

const escapeXml = (value) =>
  String(value ?? '').replace(/[<>&"']/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });

const fit = (text, max) => {
  const value = String(text ?? '').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

export function renderBadge({ steam, faceit, lifetime }) {
  const isLinked = faceit?.linked === true;
  const name = fit(faceit?.nickname ?? steam?.personaName ?? 'Игрок', 16);

  if (!isLinked) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="88" viewBox="0 0 300 88" font-family="DejaVu Sans, Segoe UI, Arial, sans-serif">
  <rect x="0.5" y="0.5" width="299" height="87" rx="14" fill="#0c111a" stroke="rgba(255,255,255,0.12)"/>
  <text x="22" y="38" fill="#e9eef7" font-size="16" font-weight="bold">${escapeXml(name)}</text>
  <text x="22" y="62" fill="#8a94a6" font-size="13">FACEIT не привязан</text>
</svg>`;
  }

  const level = faceit.level;
  const color = LEVEL_COLORS[level] ?? '#5f6a7d';
  const elo = faceit.elo ?? '—';
  const kd = lifetime?.kd !== null && lifetime?.kd !== undefined ? lifetime.kd.toFixed(2) : '—';
  const levelBadge =
    level !== null && level >= 1 && level <= 10
      ? `<rect x="12" y="16" width="56" height="56" rx="14" fill="${color}"/>
         <text x="40" y="53" text-anchor="middle" fill="#0a0d12" font-size="26" font-weight="bold">${level}</text>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="88" viewBox="0 0 300 88" font-family="DejaVu Sans, Segoe UI, Arial, sans-serif">
  <rect x="0.5" y="0.5" width="299" height="87" rx="14" fill="#0c111a" stroke="rgba(255,255,255,0.12)"/>
  ${levelBadge}
  <text x="82" y="40" fill="#e9eef7" font-size="16" font-weight="bold">${escapeXml(name)}</text>
  <text x="82" y="63" fill="#8a94a6" font-size="13">FACEIT · ${escapeXml(String(elo))} Elo · K/D ${escapeXml(String(kd))}</text>
</svg>`;
}
