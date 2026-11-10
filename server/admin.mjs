/** Приватная страница со списком жалоб: /admin?token=… */
import { REASONS } from './reports.mjs';

const escapeHtml = (value) =>
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

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Kiev',
  }).format(date);
};

const reasonLabel = (reason) => REASONS[reason] ?? reason ?? '—';

export function renderAdminPage(reports, { storage }) {
  const rows = reports
    .map((report) => {
      const steamId = escapeHtml(report.target_steam_id);
      const profileUrl = `https://steamcommunity.com/profiles/${encodeURIComponent(report.target_steam_id)}`;
      const faceitUrl = report.target_nickname
        ? `https://www.faceit.com/en/players/${encodeURIComponent(report.target_nickname)}`
        : null;
      const comment = escapeHtml(report.comment).replace(/\n/g, '<br>');

      return `
        <tr>
          <td class="date">${escapeHtml(formatDate(report.created_at))}</td>
          <td>
            <a href="${profileUrl}" target="_blank" rel="noreferrer">${steamId}</a>
            ${faceitUrl ? `<div class="sub"><a href="${faceitUrl}" target="_blank" rel="noreferrer">${escapeHtml(report.target_nickname)} на FACEIT</a></div>` : ''}
          </td>
          <td><span class="tag">${escapeHtml(reasonLabel(report.reason))}</span></td>
          <td class="comment">${comment || '<span class="muted">без комментария</span>'}</td>
          <td>${report.match_id ? `<a href="https://www.faceit.com/en/cs2/room/${encodeURIComponent(report.match_id)}" target="_blank" rel="noreferrer">матч</a>` : '<span class="muted">—</span>'}</td>
        </tr>`;
    })
    .join('');

  const storageNote =
    storage === 'postgres'
      ? 'Хранилище: Postgres — жалобы переживают рестарт и деплой.'
      : 'Хранилище: файл data/reports.json — на Render free он сбрасывается при рестарте. Для постоянного хранения добавьте DATABASE_URL.';

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Жалобы — приватная страница</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 32px 20px 60px;
      background: #070a0f; color: #e9eef7;
      font: 14px/1.55 'Segoe UI', system-ui, Arial, sans-serif;
    }
    .wrap { max-width: 1100px; margin: 0 auto; }
    h1 { margin: 0 0 6px; font-size: 24px; letter-spacing: -0.02em; }
    .lead { margin: 0 0 18px; color: #8a94a6; font-size: 13px; }
    .counter { display: inline-block; margin-bottom: 18px; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); font-size: 13px; }
    table { width: 100%; border-collapse: collapse; border: 1px solid rgba(255,255,255,.09); border-radius: 14px; overflow: hidden; }
    th, td { padding: 10px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid rgba(255,255,255,.07); }
    th { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #5f6a7d; background: rgba(255,255,255,.03); }
    tr:last-child td { border-bottom: 0; }
    a { color: #6ea8fe; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .date { color: #8a94a6; white-space: nowrap; font-size: 12.5px; }
    .sub { margin-top: 3px; font-size: 12px; color: #8a94a6; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 6px; background: rgba(255,138,61,.12); color: #ffb27a; font-size: 12px; white-space: nowrap; }
    .comment { max-width: 420px; overflow-wrap: anywhere; }
    .muted { color: #5f6a7d; }
    .empty { padding: 28px; text-align: center; color: #8a94a6; border: 1px dashed rgba(255,255,255,.14); border-radius: 14px; }
    .note { margin-top: 16px; font-size: 12px; color: #5f6a7d; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Жалобы</h1>
    <p class="lead">Приватная страница. Ничего из этого не показывается на сайте.</p>
    <div class="counter">Всего: ${reports.length}</div>
    ${
      reports.length === 0
        ? '<div class="empty">Пока ни одной жалобы.</div>'
        : `<table>
            <thead>
              <tr><th>Когда</th><th>Игрок</th><th>Причина</th><th>Комментарий</th><th>Матч</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`
    }
    <p class="note">${escapeHtml(storageNote)}</p>
  </div>
</body>
</html>`;
}
