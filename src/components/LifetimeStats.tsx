import { number, percent } from '../format';
import type { LifetimeStats as Lifetime } from '../types';

export function LifetimeStats({ lifetime }: { lifetime: Lifetime }) {
  const primary = [
    { label: 'Матчи', value: number(lifetime.matches) },
    { label: 'Победы', value: number(lifetime.wins) },
    { label: 'Winrate', value: percent(lifetime.winRate) },
    { label: 'K/D', value: number(lifetime.kd, 2) },
    { label: 'Хедшоты', value: percent(lifetime.hsPercent) },
    { label: 'MVP', value: number(lifetime.mvps) },
  ];

  const secondary = [
    { label: 'ADR', value: number(lifetime.adr, 1) },
    { label: 'Трипл-киллы', value: number(lifetime.tripleKills) },
    { label: 'Квадро-киллы', value: number(lifetime.quadroKills) },
    { label: 'Пента-киллы', value: number(lifetime.pentaKills) },
    { label: 'Серия побед', value: number(lifetime.winStreak) },
    { label: 'Рекорд серии', value: number(lifetime.longestStreak) },
  ].filter((item) => item.value !== '—');

  return (
    <section className="card">
      <header className="card__head">
        <span className="card__kicker">Статистика за всё время</span>
        {lifetime.label && <span className="card__hint">{lifetime.label}</span>}
      </header>

      <div className="stats">
        {primary.map((item) => (
          <div className="stat" key={item.label}>
            <span className="stat__value">{item.value}</span>
            <span className="stat__label">{item.label}</span>
          </div>
        ))}
      </div>

      {secondary.length > 0 && (
        <div className="stats stats--secondary">
          {secondary.map((item) => (
            <div className="stat stat--small" key={item.label}>
              <span className="stat__value">{item.value}</span>
              <span className="stat__label">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
