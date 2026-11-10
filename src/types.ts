export type SteamProfile = {
  steamId64: string;
  personaName?: string | null;
  avatar?: string | null;
  profileUrl?: string | null;
  countryCode?: string | null;
  createdAt?: string | null;
  visibility?: 'public' | 'private';
  isOnline?: boolean;
  cs2Owned?: boolean | null;
};

export type FaceitPlayer = {
  linked: true;
  game: string;
  playerId: string;
  nickname: string | null;
  avatar: string | null;
  country: string | null;
  region: string | null;
  elo: number | null;
  level: number | null;
  steamNickname: string | null;
  faceitUrl: string;
};

export type FaceitState =
  | FaceitPlayer
  | { linked: false }
  | { linked: null; reason?: 'no_key' | 'error' };

export type LifetimeStats = {
  label: string | null;
  matches: number | null;
  wins: number | null;
  winRate: number | null;
  kd: number | null;
  adr: number | null;
  hsPercent: number | null;
  mvps: number | null;
  tripleKills: number | null;
  quadroKills: number | null;
  pentaKills: number | null;
  winStreak: number | null;
  longestStreak: number | null;
};

export type Match = {
  matchId: string | null;
  startedAt: string | null;
  competition: string | null;
  gameMode: string | null;
  region: string | null;
  result: 'win' | 'loss' | null;
  score: string | null;
  faceitUrl: string | null;
  map: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  kd: number | null;
  hsPercent: number | null;
  mvps: number | null;
};

export type LookupResponse = {
  demo: boolean;
  fetchedAt: string;
  query: string;
  steamId64: string;
  steam: SteamProfile | null;
  faceit: FaceitState | null;
  lifetime: LifetimeStats | null;
  matches: Match[];
  warnings: string[];
};
