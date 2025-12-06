import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { 
  Tournament, 
  TournamentState, 
  Player, 
  Match, 
  Table, 
  TournamentSettings,
  ViewMode,
  PlayerStanding,
  PartnerHistory,
  MatchHistory,
  SavedTournamentSummary
} from '../types';
import { generateRoundPairings } from '../utils/pairingAlgorithm';

// Extended state for online mode
interface ExtendedTournamentState extends TournamentState {
  connectedPlayerId: string | null;
  onlineMode: boolean;
  setTournament: (tournament: Tournament | null) => void;
  setConnectedPlayerId: (playerId: string | null) => void;
  setOnlineMode: (online: boolean) => void;
}

const createEmptyPlayer = (name: string): Player => ({
  id: nanoid(8),
  name,
  wins: 0,
  losses: 0,
  ties: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  twenties: 0,
  byeCount: 0,
  active: true,
});

const createEmptyTournament = (name: string, totalRounds: number): Tournament => ({
  id: nanoid(10),
  name,
  players: [],
  matches: [],
  tables: [],
  currentRound: 0,
  totalRounds,
  status: 'setup',
  settings: {
    tableAssignment: false,
    playerScoreEntry: false,
    pointsPerMatch: 8,
    poolSize: 8,
  },
  shareCode: nanoid(6).toUpperCase(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const useTournamentStore = create<ExtendedTournamentState>()(
  persist(
    (set, get) => ({
      tournament: null,
      savedTournaments: [],
      viewMode: 'setup',
      isHost: true,
      connectedPlayerId: null,
      onlineMode: false,

      setTournament: (tournament: Tournament | null) => {
        set({ tournament });
      },

      setConnectedPlayerId: (playerId: string | null) => {
        set({ connectedPlayerId: playerId });
      },

      setOnlineMode: (online: boolean) => {
        set({ onlineMode: online });
      },

      createTournament: (name: string, totalRounds: number) => {
        set({
          tournament: createEmptyTournament(name, totalRounds),
          viewMode: 'setup',
        });
      },

      updateTournamentName: (name: string) => {
        set((state) => ({
          tournament: state.tournament 
            ? { ...state.tournament, name, updatedAt: Date.now() }
            : null,
        }));
      },

      updateTotalRounds: (rounds: number) => {
        set((state) => ({
          tournament: state.tournament
            ? { ...state.tournament, totalRounds: rounds, updatedAt: Date.now() }
            : null,
        }));
      },

      updateSettings: (settings: Partial<TournamentSettings>) => {
        set((state) => ({
          tournament: state.tournament
            ? {
                ...state.tournament,
                settings: { ...state.tournament.settings, ...settings },
                updatedAt: Date.now(),
              }
            : null,
        }));
      },

      addPlayer: (name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        set((state) => {
          if (!state.tournament) return state;
          
          // Check for duplicate names
          const nameExists = state.tournament.players.some(
            (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
          );
          if (nameExists) return state;

          return {
            tournament: {
              ...state.tournament,
              players: [...state.tournament.players, createEmptyPlayer(trimmedName)],
              updatedAt: Date.now(),
            },
          };
        });
      },

      removePlayer: (playerId: string) => {
        set((state) => {
          if (!state.tournament || state.tournament.status !== 'setup') return state;
          
          return {
            tournament: {
              ...state.tournament,
              players: state.tournament.players.filter((p) => p.id !== playerId),
              updatedAt: Date.now(),
            },
          };
        });
      },

      updatePlayer: (playerId: string, updates: Partial<Player>) => {
        set((state) => {
          if (!state.tournament) return state;

          return {
            tournament: {
              ...state.tournament,
              players: state.tournament.players.map((p) =>
                p.id === playerId ? { ...p, ...updates } : p
              ),
              updatedAt: Date.now(),
            },
          };
        });
      },

      addTable: (name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        set((state) => {
          if (!state.tournament) return state;

          const newTable: Table = {
            id: nanoid(6),
            name: trimmedName,
            order: state.tournament.tables.length,
          };

          return {
            tournament: {
              ...state.tournament,
              tables: [...state.tournament.tables, newTable],
              updatedAt: Date.now(),
            },
          };
        });
      },

      removeTable: (tableId: string) => {
        set((state) => {
          if (!state.tournament) return state;

          const filteredTables = state.tournament.tables
            .filter((t) => t.id !== tableId)
            .map((t, idx) => ({ ...t, order: idx }));

          return {
            tournament: {
              ...state.tournament,
              tables: filteredTables,
              updatedAt: Date.now(),
            },
          };
        });
      },

      updateTable: (tableId: string, name: string) => {
        set((state) => {
          if (!state.tournament) return state;

          return {
            tournament: {
              ...state.tournament,
              tables: state.tournament.tables.map((t) =>
                t.id === tableId ? { ...t, name } : t
              ),
              updatedAt: Date.now(),
            },
          };
        });
      },

      reorderTables: (tables: Table[]) => {
        set((state) => {
          if (!state.tournament) return state;

          return {
            tournament: {
              ...state.tournament,
              tables: tables.map((t, idx) => ({ ...t, order: idx })),
              updatedAt: Date.now(),
            },
          };
        });
      },

      startTournament: () => {
        const state = get();
        if (!state.tournament || state.tournament.players.length < 2) return;

        // Generate first round
        const { matches } = generateRoundPairings(
          state.tournament.players,
          [],
          1,
          state.tournament.tables,
          state.tournament.settings.tableAssignment
        );

        set({
          tournament: {
            ...state.tournament,
            status: 'active',
            currentRound: 1,
            matches,
            updatedAt: Date.now(),
          },
          viewMode: 'history', // Navigate to Matches page
        });
      },

      generateNextRound: () => {
        const state = get();
        if (!state.tournament) return;

        const nextRound = state.tournament.currentRound + 1;
        if (nextRound > state.tournament.totalRounds) return;

        // Check if current round is complete
        const currentRoundMatches = state.tournament.matches.filter(
          (m) => m.round === state.tournament!.currentRound
        );
        const allComplete = currentRoundMatches.every((m) => m.completed);
        if (!allComplete) return;

        // Update player stats from completed matches
        const updatedPlayers = [...state.tournament.players];
        
        currentRoundMatches.forEach((match) => {
          if (match.isBye) {
            // Bye player gets average points and a win
            const byePlayerId = match.team1[0];
            const player = updatedPlayers.find((p) => p.id === byePlayerId);
            if (player) {
              player.wins += 1;
              player.pointsFor += 4; // Average points for bye
              player.byeCount += 1;
            }
          } else if (match.score1 !== null && match.score2 !== null) {
            const team1Ids = match.team1 as [string, string];
            const team2Ids = match.team2 as [string, string];

            // Update team 1 players
            team1Ids.forEach((playerId) => {
              const player = updatedPlayers.find((p) => p.id === playerId);
              if (player) {
                player.pointsFor += match.score1!;
                player.pointsAgainst += match.score2!;
                player.twenties += match.twenties1;
                
                if (match.score1! > match.score2!) {
                  player.wins += 1;
                } else if (match.score1! < match.score2!) {
                  player.losses += 1;
                } else {
                  player.ties += 1;
                }
              }
            });

            // Update team 2 players
            team2Ids.forEach((playerId) => {
              const player = updatedPlayers.find((p) => p.id === playerId);
              if (player) {
                player.pointsFor += match.score2!;
                player.pointsAgainst += match.score1!;
                player.twenties += match.twenties2;
                
                if (match.score2! > match.score1!) {
                  player.wins += 1;
                } else if (match.score2! < match.score1!) {
                  player.losses += 1;
                } else {
                  player.ties += 1;
                }
              }
            });
          }
        });

        // Generate next round pairings
        const { matches: newMatches } = generateRoundPairings(
          updatedPlayers,
          state.tournament.matches,
          nextRound,
          state.tournament.tables,
          state.tournament.settings.tableAssignment
        );

        set({
          tournament: {
            ...state.tournament,
            players: updatedPlayers,
            matches: [...state.tournament.matches, ...newMatches],
            currentRound: nextRound,
            updatedAt: Date.now(),
          },
          viewMode: 'history', // Navigate to Matches page so players can see assignments
        });
      },

      submitScore: (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => {
        set((state) => {
          if (!state.tournament) return state;

          return {
            tournament: {
              ...state.tournament,
              matches: state.tournament.matches.map((m) =>
                m.id === matchId
                  ? { ...m, score1, score2, twenties1, twenties2, completed: true }
                  : m
              ),
              updatedAt: Date.now(),
            },
          };
        });
      },

      editScore: (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => {
        // Same as submitScore for now, but could add validation/history
        get().submitScore(matchId, score1, score2, twenties1, twenties2);
      },

      completeTournament: () => {
        const state = get();
        if (!state.tournament) return;

        // Update final player stats from last round
        const lastRoundMatches = state.tournament.matches.filter(
          (m) => m.round === state.tournament!.currentRound
        );
        
        const updatedPlayers = [...state.tournament.players];
        
        lastRoundMatches.forEach((match) => {
          if (match.isBye) {
            const byePlayerId = match.team1[0];
            const player = updatedPlayers.find((p) => p.id === byePlayerId);
            if (player) {
              player.wins += 1;
              player.pointsFor += 4;
              player.byeCount += 1;
            }
          } else if (match.score1 !== null && match.score2 !== null) {
            const team1Ids = match.team1 as [string, string];
            const team2Ids = match.team2 as [string, string];

            team1Ids.forEach((playerId) => {
              const player = updatedPlayers.find((p) => p.id === playerId);
              if (player) {
                player.pointsFor += match.score1!;
                player.pointsAgainst += match.score2!;
                player.twenties += match.twenties1;
                
                if (match.score1! > match.score2!) player.wins += 1;
                else if (match.score1! < match.score2!) player.losses += 1;
                else player.ties += 1;
              }
            });

            team2Ids.forEach((playerId) => {
              const player = updatedPlayers.find((p) => p.id === playerId);
              if (player) {
                player.pointsFor += match.score2!;
                player.pointsAgainst += match.score1!;
                player.twenties += match.twenties2;
                
                if (match.score2! > match.score1!) player.wins += 1;
                else if (match.score2! < match.score1!) player.losses += 1;
                else player.ties += 1;
              }
            });
          }
        });

        set({
          tournament: {
            ...state.tournament,
            players: updatedPlayers,
            status: 'completed',
            updatedAt: Date.now(),
          },
          viewMode: 'standings',
        });
      },

      resetTournament: () => {
        set({
          tournament: null,
          viewMode: 'setup',
        });
      },

      setViewMode: (mode: ViewMode) => {
        set({ viewMode: mode });
      },

      setIsHost: (isHost: boolean) => {
        set({ isHost });
      },

      getPlayerById: (playerId: string) => {
        const state = get();
        return state.tournament?.players.find((p) => p.id === playerId);
      },

      getMatchesByRound: (round: number) => {
        const state = get();
        return state.tournament?.matches.filter((m) => m.round === round) ?? [];
      },

      getCurrentRoundMatches: () => {
        const state = get();
        if (!state.tournament) return [];
        return state.tournament.matches.filter(
          (m) => m.round === state.tournament!.currentRound
        );
      },

      getStandings: () => {
        const state = get();
        if (!state.tournament) return [];

        const players = state.tournament.players.filter((p) => p.active);
        const matches = state.tournament.matches;
        
        // Calculate stats from MATCH DATA (not stored player stats) for accuracy
        const calculatePlayerStats = (playerId: string) => {
          let wins = 0, losses = 0, ties = 0;
          let pointsFor = 0, pointsAgainst = 0, twenties = 0, byeCount = 0;

          matches.forEach((match) => {
            if (!match.completed) return;

            // Check if player is in this match
            const inTeam1 = match.team1.includes(playerId);
            const inTeam2 = match.team2?.includes(playerId);

            if (!inTeam1 && !inTeam2) return;

            if (match.isBye) {
              // Bye match
              wins += 1;
              pointsFor += match.score1 ?? 4;
              twenties += match.twenties1 ?? 0;
              byeCount += 1;
            } else if (match.score1 !== null && match.score2 !== null) {
              if (inTeam1) {
                pointsFor += match.score1;
                pointsAgainst += match.score2;
                twenties += match.twenties1 ?? 0;
                if (match.score1 > match.score2) wins += 1;
                else if (match.score1 < match.score2) losses += 1;
                else ties += 1;
              } else if (inTeam2) {
                pointsFor += match.score2;
                pointsAgainst += match.score1;
                twenties += match.twenties2 ?? 0;
                if (match.score2 > match.score1) wins += 1;
                else if (match.score2 < match.score1) losses += 1;
                else ties += 1;
              }
            }
          });

          return { wins, losses, ties, pointsFor, pointsAgainst, twenties, byeCount };
        };

        // Calculate standings with real-time stats from matches
        const standings: PlayerStanding[] = players.map((player) => {
          const stats = calculatePlayerStats(player.id);
          
          // Challonge-style score: Win=2, Tie=1, Loss=0, Bye=2 (same as win)
          // All wins (including byes) = 2 points each
          const score = (stats.wins * 2) + (stats.ties * 1);
          
          return {
            player: {
              ...player,
              wins: stats.wins,
              losses: stats.losses,
              ties: stats.ties,
              pointsFor: stats.pointsFor,
              pointsAgainst: stats.pointsAgainst,
              twenties: stats.twenties,
              byeCount: stats.byeCount,
            },
            rank: 0,
            score,
            buchholz: 0,
          };
        });

        // Sort by: score desc, point diff desc, points for desc
        standings.sort((a, b) => {
          // Primary: Challonge score (Win=2, Tie=1, Bye=1, Loss=0)
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          // Secondary: point differential
          const aDiff = a.player.pointsFor - a.player.pointsAgainst;
          const bDiff = b.player.pointsFor - b.player.pointsAgainst;
          if (bDiff !== aDiff) {
            return bDiff - aDiff;
          }
          // Tertiary: points for
          return b.player.pointsFor - a.player.pointsFor;
        });

        // Assign ranks
        standings.forEach((s, idx) => {
          s.rank = idx + 1;
        });

        return standings;
      },

      getPartnerHistory: () => {
        const state = get();
        const history: PartnerHistory = {};
        
        if (!state.tournament) return history;

        state.tournament.matches.forEach((match) => {
          if (!match.isBye && match.team1.length === 2) {
            const [p1, p2] = match.team1 as [string, string];
            if (!history[p1]) history[p1] = new Set();
            if (!history[p2]) history[p2] = new Set();
            history[p1].add(p2);
            history[p2].add(p1);
          }
          if (match.team2 && match.team2.length === 2) {
            const [p1, p2] = match.team2 as [string, string];
            if (!history[p1]) history[p1] = new Set();
            if (!history[p2]) history[p2] = new Set();
            history[p1].add(p2);
            history[p2].add(p1);
          }
        });

        return history;
      },

      getMatchHistory: () => {
        const state = get();
        const history: MatchHistory = {};
        
        if (!state.tournament) return history;

        state.tournament.matches.forEach((match) => {
          if (!match.isBye && match.team2) {
            const team1Key = [...match.team1].sort().join('-');
            const team2Key = [...match.team2].sort().join('-');
            
            if (!history[team1Key]) history[team1Key] = new Set();
            if (!history[team2Key]) history[team2Key] = new Set();
            
            history[team1Key].add(team2Key);
            history[team2Key].add(team1Key);
          }
        });

        return history;
      },

      // Tournament history management
      saveTournament: () => {
        const state = get();
        if (!state.tournament) return;

        const tournamentToSave = { ...state.tournament, updatedAt: Date.now() };
        
        set((state) => {
          // Check if this tournament already exists in saved list
          const existingIndex = state.savedTournaments.findIndex(
            (t) => t.id === tournamentToSave.id
          );

          let updatedSaved: Tournament[];
          if (existingIndex >= 0) {
            // Update existing
            updatedSaved = [...state.savedTournaments];
            updatedSaved[existingIndex] = tournamentToSave;
          } else {
            // Add new
            updatedSaved = [tournamentToSave, ...state.savedTournaments];
          }

          return { savedTournaments: updatedSaved };
        });
      },

      loadTournament: (tournamentId: string) => {
        const state = get();
        const tournamentToLoad = state.savedTournaments.find(
          (t) => t.id === tournamentId
        );

        if (tournamentToLoad) {
          set({
            tournament: { ...tournamentToLoad },
            viewMode: tournamentToLoad.status === 'completed' ? 'standings' : 'rounds',
          });
        }
      },

      deleteSavedTournament: (tournamentId: string) => {
        set((state) => ({
          savedTournaments: state.savedTournaments.filter(
            (t) => t.id !== tournamentId
          ),
        }));
      },

      getSavedTournamentSummaries: (): SavedTournamentSummary[] => {
        const state = get();
        return state.savedTournaments.map((t) => {
          // Find winner if completed
          let winner: string | undefined;
          if (t.status === 'completed') {
            const activePlayers = t.players.filter((p) => p.active);
            const sorted = [...activePlayers].sort((a, b) => {
              if (b.wins !== a.wins) return b.wins - a.wins;
              const aDiff = a.pointsFor - a.pointsAgainst;
              const bDiff = b.pointsFor - b.pointsAgainst;
              return bDiff - aDiff;
            });
            winner = sorted[0]?.name;
          }

          return {
            id: t.id,
            name: t.name,
            status: t.status,
            playerCount: t.players.length,
            currentRound: t.currentRound,
            totalRounds: t.totalRounds,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            winner,
          };
        });
      },
    }),
    {
      name: 'swiss-doubles-tournament',
      partialize: (state) => ({
        // Only persist local mode data
        savedTournaments: state.savedTournaments,
        // Don't persist online tournament state - it comes from the server
        tournament: state.onlineMode ? null : state.tournament,
        isHost: state.onlineMode ? true : state.isHost,
      }),
    }
  )
);

