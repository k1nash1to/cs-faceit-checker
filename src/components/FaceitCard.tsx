import { useState } from 'react';

import { countryFlag } from '../format';
import { hasReported, markReported } from '../reported';
import type { FaceitPlayer, FaceitState, Match } from '../types';
import { Avatar, LevelBadge } from './Bits';
import { ReportDialog } from './ReportDialog';

type Props = {
  faceit: FaceitState | null;
  steamId64: string;
  matches: Match[];
};

export function FaceitCard({ faceit, steamId64, matches }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reported, setReported] = useState(() => hasReported(steamId64));
  const isLinked = faceit?.linked === true;

  return (
    <section className={`card card--faceit${isLinked ? ' is-linked' : ''}`}>
      <header className="card__head">
        <span className="card__kicker">FACEIT</span>
        {faceit?.linked === true && (
          <a className="card__link" href={faceit.faceitUrl} target="_blank" rel="noreferrer">
            Профиль ↗
          </a>
        )}
      </header>

      {faceit?.linked === true ? <LinkedBody faceit={faceit} /> : <UnlinkedBody faceit={faceit} />}

      {faceit?.linked === true && (
        <div className="card__actions">
          <button
            type="button"
            className="ghost ghost--small"
            onClick={() => setDialogOpen(true)}
            disabled={reported}
            title={reported ? 'С этого устройства жалоба уже отправлена' : 'Жалоба видна только администратору'}
          >
            {reported ? 'Жалоба отправлена' : 'Пожаловаться'}
          </button>
          <p className="card__note card__note--inline">
            Жалоба приватная: её видит только администратор. Публичного счётчика жалоб нет.
          </p>
        </div>
      )}

      {faceit?.linked === true && dialogOpen && (
        <ReportDialog
          steamId64={steamId64}
          nickname={faceit.nickname}
          matches={matches}
          onClose={() => setDialogOpen(false)}
          onSent={() => {
            markReported(steamId64);
            setReported(true);
          }}
        />
      )}
    </section>
  );
}

function LinkedBody({ faceit }: { faceit: FaceitPlayer }) {
  return (
    <>
      <div className="card__body">
        <Avatar src={faceit.avatar} name={faceit.nickname} size={64} />

        <div className="card__identity">
          <h3>{faceit.nickname ?? 'FACEIT-игрок'}</h3>
          <p className="status status--ok">
            <span className="status__dot" /> Steam привязан к FACEIT
          </p>

          <div className="badges">
            {faceit.country && (
              <span className="pill">
                {countryFlag(faceit.country)} {faceit.country.toUpperCase()}
              </span>
            )}
            {faceit.region && <span className="pill">{faceit.region}</span>}
          </div>
        </div>

        <LevelBadge level={faceit.level} />
      </div>

      <div className="elo">
        <span className="elo__value">{faceit.elo ?? '—'}</span>
        <span className="elo__label">Эло FACEIT</span>
      </div>
    </>
  );
}

function UnlinkedBody({ faceit }: { faceit: FaceitState | null }) {
  const notLinked = faceit?.linked === false;
  const noKey = faceit !== null && faceit.linked === null && faceit.reason === 'no_key';

  const title = notLinked ? 'Не привязан' : noKey ? 'Проверка недоступна' : 'Не удалось проверить';
  const text = notLinked
    ? 'Этот Steam-аккаунт не найден в FACEIT: игрок либо не регистрировался, либо играет с другого Steam-аккаунта.'
    : noKey
      ? 'В .env не задан FACEIT_API_KEY — привязку и статистику проверить нельзя.'
      : 'FACEIT не ответил на запрос. Попробуйте ещё раз через минуту.';

  return (
    <>
      <div className="card__body">
        <div className="avatar avatar--empty" style={{ width: 64, height: 64, fontSize: 22 }} aria-hidden="true">
          ?
        </div>

        <div className="card__identity">
          <h3>{title}</h3>
          <p className={`status ${notLinked ? 'status--muted' : 'status--warn'}`}>
            <span className="status__dot" />
            {notLinked ? 'link не найден' : 'нет данных'}
          </p>
        </div>
      </div>

      <p className="card__note">{text}</p>
    </>
  );
}
