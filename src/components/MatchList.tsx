import { mapName, timeAgo } from '../format';
import type { Match } from '../types';

export function MatchList({ matches }: { matches: Match[] }) {
  return (
    <section className="card">
      <header className="card__head">
        <span className="card__kicker">Последние матчи</span>
        <span className="card__hint">{matches.length}</span>
      </header>

      {matches.length === 0 ? (
        <p className="empty">FACEIT не вернул историю матчей для этого аккаунта.</p>
      ) : (
        <ol className="matches">
          {matches.map((match, index) => {
            const result = match.result ?? 'unknown';
            const letter = match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : '–';
            const hasKda = match.kills !== null || match.deaths !== null || match.assists !== null;

            return (
              <li key={match.matchId ?? `match-${index}`} className={`match match--${result}`}>
                <span className="match__result" aria-label={result === 'win' ? 'победа' : result === 'loss' ? 'поражение' : 'результат неизвестен'}>
                  {letter}
                </span>

                <div className="match__map">
                  <span className="match__map-name">{mapName(match.map)}</span>
                  <span className="match__date">{timeAgo(match.startedAt)}</span>
                </div>

                <div className="match__meta">
                  <span>{match.competition ?? 'FACEIT'}</span>
                  <span>{[match.gameMode, match.region].filter(Boolean).join(' · ') || '5v5 · EU'}</span>
                </div>

                <div className="match__score">{match.score ?? '—'}</div>

                <div className="match__kda">
                  <span className="match__kda-main">
                    {hasKda
                      ? `${match.kills ?? '–'} / ${match.deaths ?? '–'} / ${match.assists ?? '–'}`
                      : '—'}
                  </span>
                  <span className="match__kda-label">K / D / A</span>
                </div>

                {match.faceitUrl ? (
                  <a
                    className="match__link"
                    href={match.faceitUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Открыть матч на FACEIT"
                  >
                    ↗
                  </a>
                ) : (
                  <span className="match__link" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
