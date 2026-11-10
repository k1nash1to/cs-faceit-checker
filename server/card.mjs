/**
 * Карточка игрока: SVG -> PNG через resvg.
 *
 * Шрифты лежат в server/fonts и передаются рендереру явно — иначе на Linux
 * без установленных шрифтов текст просто не отрисуется.
 */
import path from 'node:path';

import { Resvg } from '@resvg/resvg-js';

import { ROOT } from './config.mjs';

const FONT_DIR = path.join(ROOT, 'server', 'fonts');
const FONT_FILES = [
  path.join(FONT_DIR, 'DejaVuSans.ttf'),
  path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'),
];

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

const metric = (value, digits = 0, suffix = '') =>
  value === null || value === undefined ? '—' : `${value.toFixed(digits)}${suffix}`;

async function avatarDataUri(url) {
  if (!url) return null;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 900_000) return null;

    const type = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0];
    return `data:${type};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function statBlock(x, label, value) {
  return `
    <g transform="translate(${x}, 318)">
      <rect width="250" height="150" rx="20" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
      <text x="26" y="46" fill="#5f6a7d" font-size="17" letter-spacing="2">${escapeXml(label)}</text>
      <text x="26" y="108" fill="#e9eef7" font-size="50" font-weight="bold">${escapeXml(value)}</text>
    </g>`;
}

function formBadges(matches) {
  return matches
    .slice(0, 5)
    .map((match, index) => {
      const x = 64 + index * 70;
      const win = match.result === 'win';
      const loss = match.result === 'loss';
      const fill = win ? 'rgba(53,211,153,0.16)' : loss ? 'rgba(255,95,109,0.16)' : 'rgba(255,255,255,0.06)';
      const color = win ? '#35d399' : loss ? '#ff5f6d' : '#8a94a6';
      const letter = win ? 'W' : loss ? 'L' : '–';

      return `<g transform="translate(${x}, 512)">
        <rect width="56" height="56" rx="15" fill="${fill}"/>
        <text x="28" y="38" text-anchor="middle" fill="${color}" font-size="24" font-weight="bold">${letter}</text>
      </g>`;
    })
    .join('');
}

export function buildCardParts({ steam, faceit, lifetime, matches }) {
  const isLinked = faceit?.linked === true;

  const name = fit(steam?.personaName ?? (isLinked ? faceit.nickname : null) ?? 'Игрок', 22);
  const faceitNick = isLinked ? fit(faceit.nickname ?? '', 26) : null;
  const level = isLinked ? faceit.level : null;
  const levelColor = LEVEL_COLORS[level] ?? '#5f6a7d';

  const subtitleParts = [];
  if (faceitNick) subtitleParts.push(faceitNick);
  if (isLinked && faceit.region) subtitleParts.push(faceit.region);
  if (isLinked && faceit.country) subtitleParts.push(faceit.country.toUpperCase());

  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : 'FACEIT не привязан';
  const elo = isLinked && faceit.elo !== null ? String(faceit.elo) : '—';

  const levelBadge =
    level !== null && level >= 1 && level <= 10
      ? `<g transform="translate(1010, 128)">
           <rect width="96" height="96" rx="24" fill="${levelColor}"/>
           <text x="48" y="66" text-anchor="middle" fill="#0a0d12" font-size="46" font-weight="bold">${level}</text>
         </g>`
      : '';

  const blocks = [
    statBlock(64, 'ЭЛО FACEIT', elo),
    statBlock(338, 'МАТЧЕЙ', isLinked ? metric(lifetime?.matches) : '—'),
    statBlock(612, 'WINRATE', isLinked ? metric(lifetime?.winRate, 1, '%') : '—'),
    statBlock(886, 'K/D', isLinked ? metric(lifetime?.kd, 2) : '—'),
  ].join('');

  return { name, subtitle, levelBadge, blocks, elo, isLinked };
}

export async function renderCard(data) {
  const { steam, faceit, matches, siteLabel } = data;
  const isLinked = faceit?.linked === true;

  const { name, subtitle, levelBadge, blocks } = buildCardParts(data);

  const avatar = await avatarDataUri(steam?.avatar);
  const initial = escapeXml((name[0] ?? '?').toUpperCase());

  const avatarNode = avatar
    ? `<defs><clipPath id="avatarClip"><circle cx="136" cy="196" r="64"/></clipPath></defs>
       <image href="${avatar}" x="72" y="132" width="128" height="128" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>
       <circle cx="136" cy="196" r="64" fill="none" stroke="rgba(255,255,255,0.14)"/>`
    : `<circle cx="136" cy="196" r="64" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)"/>
       <text x="136" y="218" text-anchor="middle" fill="#8a94a6" font-size="52" font-weight="bold">${initial}</text>`;

  const form = matches.length > 0 ? formBadges(matches) : '';
  const formLabel = matches.length > 0 ? 'ПОСЛЕДНИЕ МАТЧИ' : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="DejaVu Sans">
  <defs>
    <radialGradient id="glow1" cx="12%" cy="-8%" r="70%">
      <stop offset="0%" stop-color="rgba(255,138,61,0.22)"/>
      <stop offset="100%" stop-color="rgba(255,138,61,0)"/>
    </radialGradient>
    <radialGradient id="glow2" cx="92%" cy="-4%" r="65%">
      <stop offset="0%" stop-color="rgba(110,168,254,0.18)"/>
      <stop offset="100%" stop-color="rgba(110,168,254,0)"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="#070a0f"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>

  <text x="64" y="72" fill="#8a94a6" font-size="18" letter-spacing="4">CS2 · FACEIT CHECKER</text>
  <text x="1136" y="72" text-anchor="end" fill="#5f6a7d" font-size="18">${escapeXml(siteLabel)}</text>

  ${avatarNode}
  <text x="248" y="188" fill="#e9eef7" font-size="46" font-weight="bold">${escapeXml(name)}</text>
  <text x="248" y="232" fill="#8a94a6" font-size="24">${escapeXml(subtitle)}</text>
  ${levelBadge}

  ${blocks}

  <text x="64" y="500" fill="#5f6a7d" font-size="17" letter-spacing="2">${formLabel}</text>
  ${form}

  <line x1="64" y1="592" x2="1136" y2="592" stroke="rgba(255,255,255,0.08)"/>
  <text x="64" y="622" fill="#5f6a7d" font-size="16">Данные: Steam Web API · FACEIT Data API</text>
  ${
    isLinked
      ? ''
      : '<text x="1136" y="622" text-anchor="end" fill="#ff8a3d" font-size="16">аккаунт не привязан к FACEIT</text>'
  }
</svg>`;

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: 'DejaVu Sans',
    },
    background: '#070a0f',
  });

  return resvg.render().asPng();
}
