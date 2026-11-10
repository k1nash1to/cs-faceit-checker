import { Spinner } from './Bits';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

export function SearchBar({ value, onChange, onSubmit, loading }: Props) {
  return (
    <form
      className="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      role="search"
    >
      <span className="search__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </span>

      <input
        className="search__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="steamcommunity.com/id/… или 7656119…"
        aria-label="Steam ID или ссылка на профиль"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
      />

      <button className="search__button" type="submit" disabled={loading || value.trim().length === 0}>
        {loading ? <Spinner /> : 'Проверить'}
      </button>
    </form>
  );
}
