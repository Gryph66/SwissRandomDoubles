// Core data types for Swiss Doubles Tournament

export interface Player {
  id: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  twenties: number;
  byeCount: number;
  active: boolean;
}

export type MatchType = 'doubles' | '1v1' | '2v1' | 'bye';
export type ByeGameMode = 'byes_only' | '1v1_2v1' | '1v1_1v1bye';

export interface Match {
  id: string;
  round: number;
  team1: [string, string] | [string]; // Player IDs - single player for bye or 1v1
  team2: [string, string] | [string] | null; // null for bye, single for 1v1, pair for doubles/2v1
  score1: number | null;
  score2: number | null;
  twenties1: number;
  twenties2: number;
  tableId: string | null;
  completed: boolean;
  isBye: boolean;
  matchType?: MatchType; // Type of match - optional for backwards compatibility
}

export interface Table {
  id: string;
  name: string;
  order: number;
}

export interface TournamentSettings {
  tableAssignment: boolean;
  playerScoreEntry: boolean;
  pointsPerMatch: number; // Default 8 for Crokinole
  poolSize: number; // Default 8 - for post-tournament pool grouping
  finalsEnabled: boolean; // Enable Finals/Bracket mode
  byeGameMode: ByeGameMode; // How to handle leftover players
}

export type TournamentStatus = 'setup' | 'active' | 'finals_setup' | 'finals_active' | 'completed';

// Finals/Bracket mode types
export type BracketType = 'none' | 'final' | 'semifinals' | 'quarterfinals';

export type BracketRound = 'quarterfinal' | 'semifinal' | 'final' | 'third_place';

export interface BracketMatch {
  id: string;
  poolId: string;              // Which pool this bracket belongs to
  round: BracketRound;
  matchNumber: number;         // Position in bracket (1, 2, 3, 4...)
  team1: [string, string] | null;  // Player IDs, null if TBD
  team2: [string, string] | null;
  score1: number | null;
  score2: number | null;
  twenties1: number;
  twenties2: number;
  completed: boolean;
  winnerId: string | null;     // Team key (sorted player IDs joined with '-')
  nextMatchId: string | null;  // Where winner advances
  sourceMatch1Id: string | null; // Where team1 comes from
  sourceMatch2Id: string | null; // Where team2 comes from
}

export interface PoolBracketConfig {
  poolId: string;
  poolName: string;            // "Pool A", "Pool B", etc.
  bracketType: BracketType;
  playerIds: string[];         // Players in this pool (from Swiss)
  includeThirdPlace: boolean;  // Whether to include 3rd place match for this pool
  seedingPairs?: [number, number][]; // Custom seeding by rank (deprecated in favor of manualTeams)
  manualTeams?: [string, string][]; // Custom teams defined by player IDs
}

export interface FinalsConfig {
  enabled: boolean;
  poolConfigs: PoolBracketConfig[];
  configured: boolean;         // Has director configured brackets?
}

export interface Tournament {
  id: string;
  name: string;
  players: Player[];
  matches: Match[];
  tables: Table[];
  currentRound: number;
  totalRounds: number;
  status: TournamentStatus;
  settings: TournamentSettings;
  shareCode: string;
  createdAt: number;
  updatedAt: number;
  pairingLogs?: RoundLog[]; // Optional for backwards compatibility
  finalsConfig?: FinalsConfig; // Finals bracket configuration
  bracketMatches: BracketMatch[]; // Bracket playoff matches
}

// Helper types for pairing algorithm
export interface PlayerStanding {
  player: Player;
  rank: number;
  score: number; // Challonge-style: Win=2, Tie=1, Loss=0, Bye=2 (same as win)
  buchholz: number; // Tiebreaker score
}

export interface TeamPairing {
  player1Id: string;
  player2Id: string;
}

export interface MatchPairing {
  team1: TeamPairing;
  team2: TeamPairing;
  tableId: string | null;
}

// Partnership history tracking
export interface PartnerHistory {
  [playerId: string]: Set<string>;
}

// Match history tracking (which teams have played each other)
export interface MatchHistory {
  [teamKey: string]: Set<string>; // teamKey is sorted player IDs joined
}

// Pairing log types for transparency
export interface PairingLogEntry {
  timestamp: string;
  round: number;
  phase: 'bye_selection' | 'team_formation' | 'match_pairing';
  decision: string;
  details: string[];
}

export interface PlayerSnapshot {
  rank: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointDiff: number;
  byeCount: number;
}

export interface MatchPairingLog {
  table?: string;
  team1: string[];
  team2: string[] | null;
  isBye: boolean;
  reasoning: string;
}

export interface RoundLog {
  round: number;
  generatedAt: string;
  playerCount: number;
  byesNeeded: number;
  entries: PairingLogEntry[];
  standingsSnapshot: PlayerSnapshot[];
  finalPairings: MatchPairingLog[];
}

// View modes
export type ViewMode = 'setup' | 'schedule' | 'rounds' | 'standings' | 'history' | 'analysis' | 'admin' | 'bracket' | 'finals' | 'finals_config';

// Final standings (combining Swiss and bracket results)
export interface FinalStanding {
  playerId: string;
  playerName: string;
  finalPosition: number;       // 1, 2, 3, 4, etc.
  poolName: string;
  bracketResult: string;       // "Champion", "Runner-up", "Semifinalist", "Quarterfinalist", "Swiss Only"
  swissRank: number;
}

// Saved tournament summary (lighter weight for list display)
export interface SavedTournamentSummary {
  id: string;
  name: string;
  status: TournamentStatus;
  playerCount: number;
  currentRound: number;
  totalRounds: number;
  createdAt: number;
  updatedAt: number;
  winner?: string; // Name of winner if completed
}

// Store state
export interface TournamentState {
  tournament: Tournament | null;
  savedTournaments: Tournament[];
  viewMode: ViewMode;
  isHost: boolean;
  connectedPlayerId: string | null;
  onlineMode: boolean;

  // Actions
  createTournament: (name: string, totalRounds: number) => void;
  updateTournamentName: (name: string) => void;
  updateTotalRounds: (rounds: number) => void;
  updateSettings: (settings: Partial<TournamentSettings>) => void;

  addPlayer: (name: string) => void;
  removePlayer: (playerId: string) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;

  addTable: (name: string) => void;
  removeTable: (tableId: string) => void;
  updateTable: (tableId: string, name: string) => void;
  reorderTables: (tables: Table[]) => void;

  startTournament: () => void;
  generateNextRound: () => void;
  submitScore: (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => void;
  editScore: (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => void;

  completeTournament: () => void;
  resetTournament: () => void;

  // Tournament history
  saveTournament: () => void;
  loadTournament: (tournamentId: string) => void;
  deleteSavedTournament: (tournamentId: string) => void;
  getSavedTournamentSummaries: () => SavedTournamentSummary[];

  setViewMode: (mode: ViewMode) => void;
  setIsHost: (isHost: boolean) => void;
  setTournament: (tournament: Tournament | null) => void;
  setConnectedPlayerId: (playerId: string | null) => void;
  setOnlineMode: (online: boolean) => void;

  // Utility
  getPlayerById: (playerId: string) => Player | undefined;
  getMatchesByRound: (round: number) => Match[];
  getCurrentRoundMatches: () => Match[];
  getStandings: () => PlayerStanding[];
  getPartnerHistory: () => PartnerHistory;
  getMatchHistory: () => MatchHistory;

  // Finals/Bracket mode
  configureFinalsMode: (poolConfigs: PoolBracketConfig[]) => void;
  generateBrackets: () => void;
  generateFinals: (poolConfigs: PoolBracketConfig[]) => void; // Combined action
  submitBracketScore: (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => void;
  editBracketScore: (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => void;
  getFinalStandings: () => FinalStanding[];
  getBracketMatchesByPool: (poolId: string) => BracketMatch[];
}

