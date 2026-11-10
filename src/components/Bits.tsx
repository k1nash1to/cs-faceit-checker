import type { FC } from 'react';

const LEVEL_COLORS: Record<number, string> = {
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

export function Avatar({ src, name, size = 56 }: { src?: string | null; name?: string | null; size?: number }) {
  const initials = (name ?? '').trim().slice(0, 2).toUpperCase() || '?';
  const style = { width: size, height: size, fontSize: Math.round(size * 0.34) };

  if (src) {
    return (
      <img
        className="avatar"
        style={style}
        src={src}
        alt={name ? `Аватар ${name}` : 'Аватар'}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="avatar avatar--empty" style={style} aria-hidden="true">
      {initials}
    </div>
  );
}

export function LevelBadge({ level }: { level: number | null }) {
  if (level === null || level < 1 || level > 10) return null;
  return (
    <span className="level" style={{ background: LEVEL_COLORS[level] }} title={`FACEIT level ${level}`}>
      {level}
    </span>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function LoadingPanel() {
  return (
    <div className="results" aria-busy="true" aria-label="Загружаем данные">
      <div className="duo">
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
      </div>
      <div className="skeleton skeleton--stats" />
      <div className="skeleton skeleton--list" />
    </div>
  );
}

export const ErrorPanel: FC<{ message: string; hint: string | null; onRetry: () => void }> = ({
  message,
  hint,
  onRetry,
}) => (
  <div className="error" role="alert">
    <div className="error__icon">!</div>
    <div>
      <h2 className="error__title">{message}</h2>
      {hint && <p className="error__hint">{hint}</p>}
    </div>
    <button type="button" className="ghost" onClick={onRetry}>
      Повторить
    </button>
  </div>
);

export function DemoNotice() {
  return (
    <div className="notice notice--demo">
      <strong>Демо-данные.</strong> Ключи <code>STEAM_API_KEY</code> и <code>FACEIT_API_KEY</code> не заданы,
      поэтому показан тестовый профиль. Добавьте ключи в <code>.env</code> — и сайт начнёт отдавать реальные данные.
    </div>
  );
}

export function WarningList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="warnings">
      {items.map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  );
}
