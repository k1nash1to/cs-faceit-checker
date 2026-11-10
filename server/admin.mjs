/** Серверный рендер админки: страница входа и панель с жалобами и админами. */
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
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Kiev',
  }).format(date);
};

const reasonLabel = (reason) => REASONS[reason] ?? reason ?? '—';

const FLASH = {
  ok: {
    welcome: 'Добро пожаловать.',
    created: 'Админ добавлен.',
    deleted: 'Админ удалён.',
  },
  error: {
    taken: 'Такой логин уже занят.',
    invalid: 'Логин: 3–32 символа (латиница, цифры, _ . -). Пароль: минимум 8 символов.',
    owner: 'Владельца удалить нельзя.',
    missing: 'Админ не найден.',
  },
};

const layout = ({ title, body, user }) => `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh;
      background: radial-gradient(700px 400px at 15% -10%, rgba(255,138,61,.12), transparent 60%), #070a0f;
      color: #e9eef7; font: 14px/1.55 'Segoe UI', system-ui, Arial, sans-serif;
    }
    .top {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 14px 24px; border-bottom: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.02);
    }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: -.01em; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #ff8a3d; box-shadow: 0 0 0 4px rgba(255,138,61,.16); }
    .who { color: #8a94a6; font-size: 13px; display: flex; align-items: center; gap: 12px; }
    .badge { padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,.12); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .badge--owner { color: #ffb27a; border-color: rgba(255,138,61,.35); background: rgba(255,138,61,.1); }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 24px 20px 60px; }
    h1 { margin: 0 0 6px; font-size: 24px; letter-spacing: -.02em; }
    h2 { margin: 30px 0 12px; font-size: 17px; letter-spacing: -.01em; }
    .lead { margin: 0 0 18px; color: #8a94a6; font-size: 13px; }
    .counter { display: inline-block; margin-bottom: 16px; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); font-size: 13px; }
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
    .empty { padding: 24px; text-align: center; color: #8a94a6; border: 1px dashed rgba(255,255,255,.14); border-radius: 14px; }
    .flash { margin-bottom: 16px; padding: 10px 14px; border-radius: 10px; font-size: 13.5px; }
    .flash--ok { color: #35d399; border: 1px solid rgba(53,211,153,.3); background: rgba(53,211,153,.08); }
    .flash--err { color: #ff5f6d; border: 1px solid rgba(255,95,109,.3); background: rgba(255,95,109,.08); }
    .note { margin-top: 16px; font-size: 12px; color: #5f6a7d; }
    form.inline { display: inline; }
    button, .btn {
      font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
      padding: 8px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,.15);
      background: rgba(255,255,255,.06); color: #e9eef7; text-decoration: none;
    }
    button:hover, .btn:hover { background: rgba(255,255,255,.11); text-decoration: none; }
    .btn--primary { border: 0; background: linear-gradient(180deg,#ff9a52,#f5761f); color: #14100a; }
    .btn--danger { color: #ff8a94; border-color: rgba(255,95,109,.35); }
    .add-form { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; margin-bottom: 14px; }
    .add-form input {
      width: 100%; padding: 9px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,.15);
      background: rgba(255,255,255,.04); color: #e9eef7; font: inherit; font-size: 14px;
    }
    .login-wrap { min-height: 100vh; display: grid; place-items: center; padding: 20px; }
    .login-card { width: min(380px, 100%); padding: 26px; border-radius: 20px; border: 1px solid rgba(255,255,255,.12); background: #0c111a; box-shadow: 0 24px 60px -24px rgba(0,0,0,.85); }
    .login-card h1 { font-size: 21px; }
    .login-card label { display: block; margin-top: 14px; }
    .login-card span { display: block; margin-bottom: 6px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #5f6a7d; }
    .login-card input {
      width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,.15);
      background: rgba(255,255,255,.04); color: #e9eef7; font: inherit; font-size: 14px;
    }
    .login-card button { width: 100%; margin-top: 20px; padding: 11px; font-size: 14px; }
    @media (max-width: 720px) {
      .add-form { grid-template-columns: 1fr; }
      .top { padding: 12px 16px; }
      .wrap { padding: 18px 14px 48px; }
    }
  </style>
</head>
<body>
  ${user ? `<header class="top">
    <div class="brand"><span class="dot"></span> CS2 FACEIT Checker · админка</div>
    <div class="who">
      <span>${escapeHtml(user.login)}</span>
      <span class="badge ${user.role === 'owner' ? 'badge--owner' : ''}">${user.role === 'owner' ? 'owner' : 'admin'}</span>
      <form class="inline" method="post" action="/admin/logout"><button type="submit">Выйти</button></form>
    </div>
  </header>` : ''}
  ${body}
</body>
</html>`;

export function renderLoginPage({ error = false, login = '' } = {}) {
  const body = `<div class="login-wrap">
    <form class="login-card" method="post" action="/admin/login">
      <h1>Вход в админку</h1>
      <p class="lead">Доступ только у администраторов сайта.</p>
      ${error ? '<div class="flash flash--err">Неверный логин или пароль.</div>' : ''}
      <label>
        <span>Логин</span>
        <input name="login" value="${escapeHtml(login)}" autocomplete="username" required autofocus>
      </label>
      <label>
        <span>Пароль</span>
        <input name="password" type="password" autocomplete="current-password" required>
      </label>
      <button class="btn--primary" type="submit">Войти</button>
    </form>
  </div>`;

  return layout({ title: 'Вход в админку', body, user: null });
}

export function renderPanelPage({ reports, admins, me, storage, flash }) {
  const flashBlock = flash?.type
    ? `<div class="flash flash--${flash.type === 'ok' ? 'ok' : 'err'}">${escapeHtml(flash.text)}</div>`
    : '';

  const reportRows = reports
    .map((report) => {
      const profileUrl = `https://steamcommunity.com/profiles/${encodeURIComponent(report.target_steam_id)}`;
      const faceitUrl = report.target_nickname
        ? `https://www.faceit.com/en/players/${encodeURIComponent(report.target_nickname)}`
        : null;
      const comment = escapeHtml(report.comment).replace(/\n/g, '<br>');

      return `<tr>
        <td class="date">${escapeHtml(formatDate(report.created_at))}</td>
        <td>
          <a href="${profileUrl}" target="_blank" rel="noreferrer">${escapeHtml(report.target_steam_id)}</a>
          ${faceitUrl ? `<div class="sub"><a href="${faceitUrl}" target="_blank" rel="noreferrer">${escapeHtml(report.target_nickname)} на FACEIT</a></div>` : ''}
        </td>
        <td><span class="tag">${escapeHtml(reasonLabel(report.reason))}</span></td>
        <td class="comment">${comment || '<span class="muted">без комментария</span>'}</td>
        <td>${report.match_id ? `<a href="https://www.faceit.com/en/cs2/room/${encodeURIComponent(report.match_id)}" target="_blank" rel="noreferrer">матч</a>` : '<span class="muted">—</span>'}</td>
      </tr>`;
    })
    .join('');

  const reportsBlock = reports.length === 0
    ? '<div class="empty">Пока ни одной жалобы.</div>'
    : `<table>
        <thead><tr><th>Когда</th><th>Игрок</th><th>Причина</th><th>Комментарий</th><th>Матч</th></tr></thead>
        <tbody>${reportRows}</tbody>
      </table>`;

  const adminsBlock =
    me.role === 'owner'
      ? `
      <h2>Администраторы</h2>
      <p class="lead">Только владелец может выдавать и отзывать доступ. Пароль показывается один раз — сразу передайте его админу.</p>
      <form class="add-form" method="post" action="/admin/admins">
        <input name="login" placeholder="логин" autocomplete="off" required>
        <input name="password" type="password" placeholder="пароль, минимум 8 символов" autocomplete="new-password" required>
        <button class="btn--primary" type="submit">Добавить</button>
      </form>
      <table>
        <thead><tr><th>Логин</th><th>Роль</th><th>Создан</th><th>Последний вход</th><th></th></tr></thead>
        <tbody>
          ${admins
            .map(
              (admin) => `<tr>
                <td>${escapeHtml(admin.login)}</td>
                <td><span class="badge ${admin.role === 'owner' ? 'badge--owner' : ''}">${admin.role === 'owner' ? 'owner' : 'admin'}</span></td>
                <td class="date">${escapeHtml(formatDate(admin.created_at))}</td>
                <td class="date">${escapeHtml(formatDate(admin.last_login_at))}</td>
                <td>${
                  admin.role === 'owner'
                    ? '<span class="muted">—</span>'
                    : `<form class="inline" method="post" action="/admin/admins/${encodeURIComponent(admin.id)}/delete">
                         <button class="btn--danger" type="submit">Удалить</button>
                       </form>`
                }</td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table>`
      : '';

  const body = `<div class="wrap">
    ${flashBlock}
    <h1>Жалобы</h1>
    <p class="lead">Приватный список. На сайте жалобы нигде не отображаются.</p>
    <div class="counter">Всего: ${reports.length}</div>
    ${reportsBlock}
    ${adminsBlock}
    <p class="note">${
      storage === 'postgres'
        ? 'Хранилище: Postgres — данные переживают рестарт и деплой.'
        : 'Хранилище: файлы data/*.json — на Render free они сбрасываются при рестарте. Для постоянного хранения добавьте DATABASE_URL.'
    }</p>
  </div>`;

  return layout({ title: 'Админка — жалобы', body, user: me });
}

export const flashText = (type, code) => FLASH[type]?.[code] ?? null;
