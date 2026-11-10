import { countryFlag, formatDate } from '../format';
import type { SteamProfile } from '../types';
import { Avatar } from './Bits';

export function SteamCard({ steam }: { steam: SteamProfile | null }) {
  const owned = steam?.cs2Owned;
  const ownedClass = owned === true ? 'pill--ok' : owned === false ? 'pill--danger' : 'pill--muted';
  const ownedLabel =
    owned === true ? 'CS2 в библиотеке' : owned === false ? 'CS2 не найден' : 'Библиотека скрыта';

  return (
    <section className="card">
      <header className="card__head">
        <span className="card__kicker">Steam</span>
        {steam?.profileUrl && (
          <a className="card__link" href={steam.profileUrl} target="_blank" rel="noreferrer">
            Профиль ↗
          </a>
        )}
      </header>

      <div className="card__body">
        <Avatar src={steam?.avatar} name={steam?.personaName} size={64} />

        <div className="card__identity">
          <h3>{steam?.personaName ?? 'Профиль Steam'}</h3>
          <p className="mono">{steam?.steamId64 ?? '—'}</p>

          <div className="badges">
            <span className={`pill ${ownedClass}`}>{ownedLabel}</span>
            {steam?.countryCode && (
              <span className="pill">
                {countryFlag(steam.countryCode)} {steam.countryCode.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="facts">
        <div>
          <dt>Аккаунт создан</dt>
          <dd>{formatDate(steam?.createdAt)}</dd>
        </div>
        <div>
          <dt>Профиль</dt>
          <dd>{steam?.visibility === 'private' ? 'Закрыт' : 'Открыт'}</dd>
        </div>
      </dl>
    </section>
  );
}
