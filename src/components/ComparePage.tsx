import { useCallback, useEffect, useState } from 'react';

import { ApiError, lookup } from '../api';
import { countryFlag, number, percent } from '../format';
import type { LookupResponse } from '../types';
import { Avatar, LevelBadge, LoadingPanel } from './Bits';

type Props = {
  initialA?: string;
  initialB?: string;
};

type Row = {
  label: string;
  left: number | null;
  right: number | null;
  format: (value: number | null) => string;
  better: 'higher' | 'lower' | 'none';
};

const fmtInt = (value: number | null) => (value === null ? '—' : number(value));
const fmtPct = (value: number | null) => (value === null ? '—' : percent(value));
const fmtDec = (value: number | null) => (value === null ? '—' : number(value, 2));

const nameOf = (player: LookupResponse) =>
  player.steam?.personaName ??
  (player.faceit?.linked === true ? player.faceit.nickname : null) ??
  player.steamId64;

const faceitOf = (player: LookupResponse) => (player.faceit?.linked === true ? player.faceit : null);

function buildRows(left: LookupResponse, right: LookupResponse): Row[] {
  const lf = faceitOf(left);
  const rf = faceitOf(right);

  return [
    { label: 'Эло FACEIT', left: lf?.elo ?? null, right: rf?.elo ?? null, format: fmtInt, better: 'higher' },
    { label: 'Уровень', left: lf?.level ?? null, right: rf?.level ?? null, format: fmtInt, better: 'higher' },
    { label: 'Матчи', left: left.lifetime?.matches ?? null, right: right.lifetime?.matches ?? null, format: fmtInt, better: 'none' },
    { label: 'Winrate', left: left.lifetime?.winRate ?? null, right: right.lifetime?.winRate ?? null, format: fmtPct, better: 'higher' },
    { label: 'K/D', left: left.lifetime?.kd ?? null, right: right.lifetime?.kd ?? null, format: fmtDec, better: 'higher' },
    { label: 'Хедшоты', left: left.lifetime?.hsPercent ?? null, right: right.lifetime?.hsPercent ?? null, format: fmtPct, better: 'higher' },
    { label: 'ADR', left: left.lifetime?.adr ?? null, right: right.lifetime?.adr ?? null, format: fmtDec, better: 'higher' },
    { label: 'MVP', left: left.lifetime?.mvps ?? null, right: right.lifetime?.mvps ?? null, format: fmtInt, better: 'higher' },
  ];
}

function winnerOf(row: Row): 'left' | 'right' | 'tie' | null {
  if (row.better === 'none' || row.left === null || row.right === null) return null;
  if (row.left === row.right) return 'tie';
  const leftBetter = row.better === 'higher' ? row.left > row.right : row.left < row.right;
  return leftBetter ? 'left' : 'right';
}

export function ComparePage({ initialA = '', initialB = '' }: Props) {
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<LookupResponse | null>(null);
  const [right, setRight] = useState<LookupResponse | null>(null);

  const compare = useCallback(async (qa: string, qb: string) => {
    const first = qa.trim();
    const second = qb.trim();
    if (!first || !second) return;

    setStatus('loading');
    setError(null);

    try {
      // Матчи для сравнения не нужны — берём минимум, чтобы не тратить лимит FACEIT.
      const [leftData, rightData] = await Promise.all([
        lookup(first, { matches: 1 }),
        lookup(second, { matches: 1 }),
      ]);

      setLeft(leftData);
      setRight(rightData);
      setStatus('ready');

      const next = `/compare/${leftData.steamId64}/${rightData.steamId64}`;
      if (window.location.pathname !== next) window.history.pushState({}, '', next);
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить игроков');
    }
  }, []);

  useEffect(() => {
    if (initialA && initialB) void compare(initialA, initialB);
  }, [initialA, initialB, compare]);

  const rows = left && right ? buildRows(left, right) : [];
  const comparable = rows.filter((row) => winnerOf(row) !== null);

  const leftWins = comparable.filter((row) => winnerOf(row) === 'left').length;
  const rightWins = comparable.filter((row) => winnerOf(row) === 'right').length;
  const ties = comparable.length - leftWins - rightWins;

  const verdict =
    comparable.length === 0
      ? 'Недостаточно данных для сравнения'
      : leftWins === rightWins
        ? 'По показателям ничья'
        : `${leftWins > rightWins ? nameOf(left!) : nameOf(right!)} сильнее в ${Math.max(leftWins, rightWins)} из ${comparable.length}`;

  return (
    <div className="app">
      <header className="compare-hero">
        <a className="back-link" href="/">
          ← На главную
        </a>
        <h1 className="compare-hero__title">Сравнение игроков</h1>
        <p className="compare-hero__sub">Два Steam ID — и видно, кто в чём сильнее.</p>

        <form
          className="compare-form"
          onSubmit={(event) => {
            event.preventDefault();
            void compare(a, b);
          }}
        >
          <input
            className="compare-form__input"
            value={a}
            onChange={(event) => setA(event.target.value)}
            placeholder="Первый: Steam ID, ссылка или ник"
            aria-label="Первый игрок"
          />
          <span className="compare-form__vs">vs</span>
          <input
            className="compare-form__input"
            value={b}
            onChange={(event) => setB(event.target.value)}
            placeholder="Второй: Steam ID, ссылка или ник"
            aria-label="Второй игрок"
          />
          <button className="compare-form__button" type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Считаем…' : 'Сравнить'}
          </button>
        </form>

        {error && <p className="compare-error">{error}</p>}
      </header>

      <main className="container">
        {status === 'loading' && <LoadingPanel />}

        {status === 'ready' && left && right && (
          <div className="results">
            <div className="compare-verdict">
              <span className="compare-verdict__text">{verdict}</span>
              {ties > 0 && <span className="compare-verdict__diff">равенство: {ties}</span>}
              {faceitOf(left)?.elo != null && faceitOf(right)?.elo != null && (
                <span className="compare-verdict__diff">
                  разница Эло: {Math.abs(faceitOf(left)!.elo! - faceitOf(right)!.elo!)}
                </span>
              )}
            </div>

            <section className="card">
              <div className="compare-head">
                <PlayerHead player={left} />
                <span className="compare-head__vs">VS</span>
                <PlayerHead player={right} align="right" />
              </div>

              <div className="compare-rows">
                {rows.map((row) => {
                  const winner = winnerOf(row);

                  return (
                    <div className="compare-row" key={row.label}>
                      <span className={`compare-row__value${winner === 'left' ? ' is-better' : ''}`}>
                        {row.format(row.left)}
                      </span>
                      <span className="compare-row__label">{row.label}</span>
                      <span
                        className={`compare-row__value compare-row__value--right${winner === 'right' ? ' is-better' : ''}`}
                      >
                        {row.format(row.right)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="share">
              <button
                type="button"
                className="ghost ghost--small"
                onClick={() => {
                  const url = `${window.location.origin}/compare/${left.steamId64}/${right.steamId64}`;
                  void navigator.clipboard?.writeText(url);
                }}
              >
                Скопировать ссылку на сравнение
              </button>
              <span className="share__hint">Ссылку можно переслать — результат откроется сразу</span>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <span>Данные: Steam Web API · FACEIT Data API</span>
        <span>Не аффилировано с Valve и FACEIT</span>
      </footer>
    </div>
  );
}

function PlayerHead({ player, align = 'left' }: { player: LookupResponse; align?: 'left' | 'right' }) {
  const faceit = faceitOf(player);
  const flag = faceit?.country ? countryFlag(faceit.country) : '';

  return (
    <div className={`compare-player compare-player--${align}`}>
      <Avatar src={player.steam?.avatar} name={nameOf(player)} size={64} />

      <div className="compare-player__text">
        <h2 className="compare-player__name">{nameOf(player)}</h2>
        <p className="compare-player__meta">
          {faceit ? (
            <>
              FACEIT {faceit.nickname}
              {flag ? ` · ${flag}` : ''}
              {faceit.region ? ` · ${faceit.region}` : ''}
            </>
          ) : (
            'FACEIT не привязан'
          )}
        </p>
        <div className="compare-player__elo">
          <span>{faceit?.elo ?? '—'}</span>
          <small>Эло</small>
        </div>
      </div>

      <LevelBadge level={faceit?.level ?? null} />
    </div>
  );
}
