/**
 * HTML для /player/:id — нужен, чтобы Discord, Telegram и поисковики видели
 * заголовок, описание и картинку. Сама страница остаётся SPA: мы лишь
 * подставляем метатеги в собранный index.html.
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './config.mjs';

const escapeAttr = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

let shell = null;
let shellLoaded = false;

function getShell() {
  if (shellLoaded) return shell;
  shellLoaded = true;

  try {
    shell = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8');
  } catch {
    shell = null;
  }

  return shell;
}

export const hasShell = () => Boolean(getShell());

export function renderProfileHtml({ steamId64, steam, faceit, lifetime, origin }) {
  const base = getShell();
  if (!base) return null;

  const isLinked = faceit?.linked === true;
  const name = steam?.personaName ?? (isLinked ? faceit.nickname : null) ?? 'Профиль игрока';
  const level = isLinked ? faceit.level : null;
  const elo = isLinked ? faceit.elo : null;

  const title =
    isLinked && elo !== null
      ? `${name} — ${elo} Elo, ${level} уровень · CS2 FACEIT`
      : `${name} — CS2 FACEIT Checker`;

  const description = isLinked
    ? `FACEIT: ${lifetime?.matches ?? '—'} матчей, winrate ${lifetime?.winRate ?? '—'}%, K/D ${lifetime?.kd ?? '—'}. Привязка Steam и статистика CS2.`
    : `Steam-аккаунт ${name} не привязан к FACEIT. Проверка привязки и статистика CS2.`;

  const canonical = `${origin}/player/${steamId64}`;
  const image = `${origin}/player/${steamId64}/card.png`;

  const tags = [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}">`,
    `<link rel="canonical" href="${escapeAttr(canonical)}">`,
    `<meta property="og:type" content="profile">`,
    `<meta property="og:site_name" content="CS2 FACEIT Checker">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:url" content="${escapeAttr(canonical)}">`,
    `<meta property="og:image" content="${escapeAttr(image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(image)}">`,
  ].join('\n    ');

  const cleaned = base
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/i, '');

  return cleaned.replace('</head>', `  ${tags}\n  </head>`);
}

export function renderCompareHtml({ a, b, left, right, origin }) {
  const base = getShell();
  if (!base) return null;

  const nameOf = (data, fallback) => {
    const linked = data?.faceit?.linked === true;
    return data?.steam?.personaName ?? (linked ? data.faceit.nickname : null) ?? fallback;
  };

  const nameA = nameOf(left, 'Игрок 1');
  const nameB = nameOf(right, 'Игрок 2');

  const eloA = left?.faceit?.linked === true ? left.faceit.elo : null;
  const eloB = right?.faceit?.linked === true ? right.faceit.elo : null;

  const parts = [];
  if (eloA !== null) parts.push(`${nameA}: ${eloA} Elo`);
  if (eloB !== null) parts.push(`${nameB}: ${eloB} Elo`);

  const title = `${nameA} vs ${nameB} — сравнение CS2`;
  const description = parts.join(' · ') || 'Сравнение двух игроков CS2 по статистике FACEIT.';
  const canonical = `${origin}/compare/${a}/${b}`;

  const tags = [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}">`,
    `<link rel="canonical" href="${escapeAttr(canonical)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="CS2 FACEIT Checker">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:url" content="${escapeAttr(canonical)}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
  ].join('\n    ');

  const cleaned = base
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/i, '');

  return cleaned.replace('</head>', `  ${tags}\n  </head>`);
}
