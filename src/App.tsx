import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, lookup } from './api';
import type { LookupResponse } from './types';
import { DemoNotice, ErrorPanel, LoadingPanel, WarningList } from './components/Bits';
import { ComparePage } from './components/ComparePage';
import { FaceitCard } from './components/FaceitCard';
import { LifetimeStats } from './components/LifetimeStats';
import { MatchList } from './components/MatchList';
import { SearchBar } from './components/SearchBar';
import { SteamCard } from './components/SteamCard';

const RECENT_KEY = 'cs-faceit:recent';
const MAX_RECENT = 5;

const EXAMPLES = [
  { label: 's1mple', value: 's1mple' },
  { label: '76561198000000000', value: '76561198000000000' },
  { label: 'ссылка на профиль', value: 'https://steamcommunity.com/id/s1mple' },
];

type Status = 'idle' | 'loading' | 'ready' | 'error';

type Route =
  | { name: 'home' }
  | { name: 'player'; id: string }
  | { name: 'compare'; a?: string; b?: string };

function parseRoute(): Route {
  const path = window.location.pathname;

  const player = path.match(/^\/player\/(\d{17})\/?$/);
  if (player) return { name: 'player', id: player[1] };

  const compare = path.match(/^\/compare(?:\/(\d{17}))?(?:\/(\d{17}))?\/?$/);
  if (compare) return { name: 'compare', a: compare[1], b: compare[2] };

  return { name: 'home' };
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export default function App() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<LookupResponse | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<{ message: string; hint: string | null } | null>(null);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setQuery(value);
    setStatus('loading');
    setError(null);

    try {
      const result = await lookup(value, { signal: controller.signal });
      if (controller.signal.aborted) return;

      setData(result);
      setStatus('ready');

      const remembered = result.query || value;
      setRecent((previous) => {
        const rest = previous.filter((item) => item.toLowerCase() !== remembered.toLowerCase());
        return [remembered, ...rest].slice(0, MAX_RECENT);
      });

      if (!result.demo && result.steamId64) {
        const next = `/player/${result.steamId64}`;
        if (window.location.pathname !== next) {
          window.history.pushState({}, '', next);
        }
        setRoute({ name: 'player', id: result.steamId64 });
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      setData(null);
      setStatus('error');
      setError({
        message: err instanceof ApiError ? err.message : 'Не удалось получить данные',
        hint: err instanceof ApiError ? err.hint : 'Проверьте соединение и попробуйте ещё раз.',
      });
    }
  }, []);

  // Сохраняем историю поиска отдельно от setState, чтобы не делать побочных эффектов в reducer.
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch {
      /* приватный режим — истории просто не будет */
    }
  }, [recent]);

  // Роутинг: /player/<id> и /compare/<a>/<b>. Ссылки можно пересылать.
  useEffect(() => {
    const initial = parseRoute();
    setRoute(initial);

    if (initial.name === 'player') {
      void run(initial.id);
    } else if (initial.name === 'home') {
      const fromQuery = new URLSearchParams(window.location.search).get('q');
      if (fromQuery) void run(fromQuery);
    }

    const onPop = () => {
      const next = parseRoute();
      setRoute(next);

      if (next.name === 'player') {
        void run(next.id);
      } else if (next.name === 'home') {
        setData(null);
        setStatus('idle');
        setQuery('');
      }
    };

    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      controllerRef.current?.abort();
    };
  }, [run]);

  if (route.name === 'compare') {
    return <ComparePage initialA={route.a} initialB={route.b} />;
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero__badge">
          <span className="dot" /> CS2 · FACEIT CHECKER
        </div>

        <h1 className="hero__title">
          Привязан ли Steam к <span>FACEIT</span> — и как он играл
        </h1>

        <p className="hero__sub">
          Вставьте Steam ID, ссылку на профиль или ник. Покажем привязку к FACEIT, Эло, пожизненную
          статистику и последние матчи с картой и счётом.
        </p>

        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={() => void run(query)}
          loading={status === 'loading'}
        />

        <div className="hero__actions">
          <a className="ghost hero__compare" href="/compare">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 8h14l-3-3M21 16H7l3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Сравнить двух игроков
          </a>
        </div>

        {recent.length > 0 && (
          <div className="recent">
            <span className="recent__label">Недавние:</span>
            {recent.map((item) => (
              <button key={item} type="button" className="chip" onClick={() => void run(item)}>
                {item}
              </button>
            ))}
          </div>
        )}

        {status === 'idle' && (
          <div className="examples">
            {EXAMPLES.map((example) => (
              <button
                key={example.value}
                type="button"
                className="chip chip--ghost"
                onClick={() => {
                  setQuery(example.value);
                  void run(example.value);
                }}
              >
                {example.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="container">
        {status === 'loading' && <LoadingPanel />}

        {status === 'error' && error && (
          <ErrorPanel message={error.message} hint={error.hint} onRetry={() => void run(query)} />
        )}

        {status === 'ready' && data && <Results data={data} />}

        {status === 'idle' && <HowItWorks />}
      </main>

      <footer className="footer">
        <span>Данные: Steam Web API · FACEIT Data API</span>
        <span>Не аффилировано с Valve и FACEIT</span>
      </footer>
    </div>
  );
}

function Results({ data }: { data: LookupResponse }) {
  const linked = data.faceit?.linked === true;
  // Плашка про демо уже всё объясняет — не дублируем её ещё и в списке предупреждений.
  const warnings = data.demo
    ? data.warnings.filter((item) => !item.startsWith('Демо-режим'))
    : data.warnings;

  return (
    <div className="results" aria-live="polite">
      {data.demo && <DemoNotice />}

      <div className="duo">
        <SteamCard steam={data.steam} />
        <FaceitCard faceit={data.faceit} steamId64={data.steamId64} matches={data.matches} />
      </div>

      {!data.demo && (
        <div className="share">
          <a
            className="ghost ghost--small"
            href={`/player/${data.steamId64}/card.png`}
            target="_blank"
            rel="noreferrer"
          >
            Карточка PNG
          </a>
          <a
            className="ghost ghost--small"
            href={`/player/${data.steamId64}/badge.svg`}
            target="_blank"
            rel="noreferrer"
          >
            Бейдж SVG
          </a>
          <button
            type="button"
            className="ghost ghost--small"
            onClick={() => {
              const url = `${window.location.origin}/player/${data.steamId64}`;
              void navigator.clipboard?.writeText(url);
            }}
          >
            Скопировать ссылку
          </button>
          <a className="ghost ghost--small" href={`/compare/${data.steamId64}`}>
            Сравнить с другим
          </a>
          <span className="share__hint">Ссылка разворачивается карточкой в Discord и Telegram</span>
        </div>
      )}

      {linked && data.lifetime && <LifetimeStats lifetime={data.lifetime} />}
      {linked && <MatchList matches={data.matches} />}

      {warnings.length > 0 && <WarningList items={warnings} />}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ['01', 'Steam ID', 'Ссылка на профиль, steamID64 или ник из steamcommunity.com/id/…'],
    ['02', 'Привязка', 'FACEIT отдаёт профиль, только если Steam-аккаунт привязан к нему.'],
    ['03', 'Статистика', 'Эло, winrate, K/D, хедшоты и последние матчи с картой и счётом.'],
  ];

  return (
    <section className="idle">
      <div className="steps">
        {steps.map(([num, title, text]) => (
          <article className="step" key={num}>
            <span className="step__num">{num}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
