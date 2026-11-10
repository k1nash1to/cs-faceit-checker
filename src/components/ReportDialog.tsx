import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';

import { ApiError, submitReport } from '../api';
import type { ReportReason } from '../api';
import { mapName, timeAgo } from '../format';
import type { Match } from '../types';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'cheats', label: 'Читы (aimbot, wallhack и т.п.)' },
  { value: 'smurf', label: 'Смурф / смесинг' },
  { value: 'toxic', label: 'Токсичность, тимкилл' },
  { value: 'other', label: 'Другое' },
];

type Props = {
  steamId64: string;
  nickname: string | null;
  matches: Match[];
  onClose: () => void;
  onSent: () => void;
};

export function ReportDialog({ steamId64, nickname, matches, onClose, onSent }: Props) {
  const [reason, setReason] = useState<ReportReason>('cheats');
  const [comment, setComment] = useState('');
  const [matchId, setMatchId] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'duplicate'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (state === 'sending') return;

    setState('sending');
    setError(null);

    try {
      const result = await submitReport({
        steamId64,
        nickname,
        matchId: matchId || null,
        reason,
        comment: comment.trim(),
      });

      if (result.ok) {
        setState('sent');
      } else {
        setState('duplicate');
      }
      onSent();
    } catch (err) {
      setState('idle');
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить жалобу');
    }
  };

  const finished = state === 'sent' || state === 'duplicate';

  // Портал обязателен: у карточки есть анимация с transform, из-за неё
  // position: fixed считается относительно карточки, а не окна.
  return createPortal(
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className="dialog__backdrop" onClick={onClose} />

      <div className="dialog__card">
        <h2 className="dialog__title" id="report-title">
          Жалоба на {nickname ?? 'игрока'}
        </h2>
        <p className="dialog__sub">
          Жалоба уходит только администратору сайта. Публично она не отображается и ни на какой счётчик
          не влияет.
        </p>

        {finished ? (
          <>
            <p className="dialog__status dialog__status--ok">
              {state === 'sent'
                ? 'Жалоба отправлена. Спасибо — это поможет разобраться.'
                : 'С этого устройства уже отправляли жалобу на этого игрока.'}
            </p>
            <div className="dialog__actions">
              <button type="button" className="ghost" onClick={onClose}>
                Закрыть
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={send}>
            <label className="field">
              <span className="field__label">Причина</span>
              <select value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>
                {REASONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            {matches.length > 0 && (
              <label className="field">
                <span className="field__label">Матч (необязательно)</span>
                <select value={matchId} onChange={(event) => setMatchId(event.target.value)}>
                  <option value="">Не привязывать к матчу</option>
                  {matches.slice(0, 8).map((match, index) => (
                    <option key={match.matchId ?? `m-${index}`} value={match.matchId ?? ''}>
                      {mapName(match.map)} · {match.score ?? '—'} · {timeAgo(match.startedAt)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              <span className="field__label">Комментарий</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={600}
                placeholder="Что произошло, в каком матче, ссылка на демо или таймкоды"
              />
            </label>

            {error && <p className="dialog__status dialog__status--err">{error}</p>}

            <div className="dialog__actions">
              <button type="button" className="ghost" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="dialog__send" disabled={state === 'sending'}>
                {state === 'sending' ? 'Отправляем…' : 'Отправить'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
