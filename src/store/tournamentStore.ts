import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  Tournament,
  TournamentState,
  Player,
  Table,
  TournamentSettings,
  ViewMode,
  PlayerStanding,
  PartnerHistory,
  MatchHistory,
  SavedTournamentSummary,
  BracketMatch,
  FinalStanding,
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
    finalsEnabled: false,
    byeGameMode: 'byes_only',
    allowViewerScoreEntry: false, // Default: only host can enter scores
  },
  shareCode: nanoid(6).toUpperCase(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  finalsConfig: {
    enabled: false,
    poolConfigs: [],
    configured: false,
  },
  bracketMatches: [],
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
          state.tournament.settings.tableAssignment,
          state.tournament.settings.byeGameMode
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
          state.tournament.settings.tableAssignment,
          state.tournament.settings.byeGameMode
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

        // If Finals Mode is enabled, go to finals_setup, otherwise complete
        const newStatus = state.tournament.settings.finalsEnabled ? 'finals_setup' : 'completed';
        const newViewMode = state.tournament.settings.finalsEnabled ? 'finals_config' : 'standings';

        set({
          tournament: {
            ...state.tournament,
            players: updatedPlayers,
            status: newStatus,
            updatedAt: Date.now(),
          },
          viewMode: newViewMode,
        });
      },

      resetTournament: () => {
        const state = get();
        if (!state.tournament) return;

        // Reset tournament to setup state but keep players, tables, settings
        const resetPlayers = state.tournament.players.map(p => ({
          ...p,
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          twenties: 0,
          byeCount: 0,
        }));

        set({
          tournament: {
            ...state.tournament,
            matches: [],
            currentRound: 0,
            status: 'setup',
            players: resetPlayers,
            updatedAt: Date.now(),
          },
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
              // Bye is always a tie (1 point) with 4-4 score
              ties += 1;
              pointsFor += match.score1 ?? 4;
              pointsAgainst += match.score2 ?? 4; // 4 points against for bye (4-4 tie)
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

          // Challonge-style score: Win=2, Tie=1, Loss=0
          // Bye is always a tie (1 point) with 4-4 score
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

        // Sort by: Score → PF → PA → 20s
        standings.sort((a, b) => {
          // Primary: Challonge score (Win=2, Tie=1, Loss=0, Bye=1)
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          // Secondary: Points For (higher is better)
          if (b.player.pointsFor !== a.player.pointsFor) {
            return b.player.pointsFor - a.player.pointsFor;
          }
          // Tertiary: Points Against (lower is better)
          if (a.player.pointsAgainst !== b.player.pointsAgainst) {
            return a.player.pointsAgainst - b.player.pointsAgainst;
          }
          // Quaternary: 20s (higher is better)
          return b.player.twenties - a.player.twenties;
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
            // Sort by: Score → PF → PA → 20s
            const sorted = [...activePlayers].sort((a, b) => {
              const aScore = a.wins * 2 + a.ties;
              const bScore = b.wins * 2 + b.ties;
              if (bScore !== aScore) return bScore - aScore;
              if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
              if (a.pointsAgainst !== b.pointsAgainst) return a.pointsAgainst - b.pointsAgainst;
              return b.twenties - a.twenties;
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

      // Finals/Bracket mode actions (stub implementations - will be fully implemented in Phase 2)
      configureFinalsMode: (poolConfigs) => {
        set((state) => {
          if (!state.tournament) return state;

          return {
            tournament: {
              ...state.tournament,
              finalsConfig: {
                enabled: true,
                poolConfigs,
                configured: true,
              },
              updatedAt: Date.now(),
            },
          };
        });
      },

      generateBrackets: () => {
        set((state) => {
          if (!state.tournament || !state.tournament.finalsConfig) return state;

          const bracketMatches: BracketMatch[] = [];

          state.tournament.finalsConfig.poolConfigs.forEach((config) => {
            if (config.bracketType === 'none') return;

            const poolPlayers = state.tournament!.players.filter(p => config.playerIds.includes(p.id));
            // Sort by Swiss rank (using standings logic implicitly or just sort by current performance)
            // But config.playerIds usually comes sorted from FinalsConfig.
            // Let's re-sort to be safe: wins > pointsFor > pointsAgainst > twenties
            poolPlayers.sort((a, b) => {
              const aScore = a.wins * 2 + a.ties;
              const bScore = b.wins * 2 + b.ties;
              if (bScore !== aScore) return bScore - aScore;
              if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
              return b.twenties - a.twenties;
            });

            // 1. Form Teams
            let teams: [string, string][] = [];

            if (config.manualTeams && config.manualTeams.length > 0) {
              teams = config.manualTeams;
            } else {
              // High-Low Pairing (Default)
              const count = poolPlayers.length;
              const numTeams = count / 2;

              for (let i = 0; i < numTeams; i++) {
                teams.push([poolPlayers[i].id, poolPlayers[count - 1 - i].id]);
              }
            }

            // Helper to create match
            const createMatch = (
              round: any,
              matchNum: number,
              t1: [string, string] | null,
              t2: [string, string] | null,
              nextId: string | null = null
            ): BracketMatch => ({
              id: nanoid(),
              poolId: config.poolId,
              round,
              matchNumber: matchNum,
              team1: t1,
              team2: t2,
              score1: null,
              score2: null,
              twenties1: 0,
              twenties2: 0,
              completed: false,
              winnerId: null,
              nextMatchId: nextId,
              sourceMatch1Id: null,
              sourceMatch2Id: null,
            });

            // 2. Build Bracket Structure
            if (config.bracketType === 'final') {
              // Final Only (4 players -> 2 teams)
              // Team 1 vs Team 2
              bracketMatches.push(createMatch('final', 1, teams[0], teams[1]));

            } else if (config.bracketType === 'semifinals') {
              // Semifinals (8 players -> 4 teams)
              // Semis: 1v4, 2v3
              const finalMatch = createMatch('final', 3, null, null);

              const semi1 = createMatch('semifinal', 1, teams[0], teams[3], finalMatch.id); // 1 vs 4
              const semi2 = createMatch('semifinal', 2, teams[1], teams[2], finalMatch.id); // 2 vs 3

              finalMatch.sourceMatch1Id = semi1.id;
              finalMatch.sourceMatch2Id = semi2.id;

              bracketMatches.push(semi1, semi2, finalMatch);

              if (config.includeThirdPlace) {
                const thirdPlace = createMatch('third_place', 4, null, null);
                thirdPlace.sourceMatch1Id = semi1.id; // Loser of Semi 1
                thirdPlace.sourceMatch2Id = semi2.id; // Loser of Semi 2
                bracketMatches.push(thirdPlace);
              }

            } else if (config.bracketType === 'quarterfinals') {
              // Quarterfinals (16 players -> 8 teams)
              // QF: 1v8, 4v5, 2v7, 3v6 (Standard bracket order for visual flow: 1v8, 4v5 top half; 2v7, 3v6 bottom half)
              // QF1: 1 vs 8
              // QF2: 4 vs 5
              // QF3: 2 vs 7
              // QF4: 3 vs 6

              const finalMatch = createMatch('final', 7, null, null);

              const semi1 = createMatch('semifinal', 5, null, null, finalMatch.id);
              const semi2 = createMatch('semifinal', 6, null, null, finalMatch.id);

              finalMatch.sourceMatch1Id = semi1.id;
              finalMatch.sourceMatch2Id = semi2.id;

              // Top Half (Feeds Semi 1)
              const qf1 = createMatch('quarterfinal', 1, teams[0], teams[7], semi1.id); // 1 vs 8
              const qf2 = createMatch('quarterfinal', 2, teams[3], teams[4], semi1.id); // 4 vs 5
              semi1.sourceMatch1Id = qf1.id;
              semi1.sourceMatch2Id = qf2.id;

              // Bottom Half (Feeds Semi 2)
              const qf3 = createMatch('quarterfinal', 3, teams[1], teams[6], semi2.id); // 2 vs 7
              const qf4 = createMatch('quarterfinal', 4, teams[2], teams[5], semi2.id); // 3 vs 6
              semi2.sourceMatch1Id = qf3.id;
              semi2.sourceMatch2Id = qf4.id;

              bracketMatches.push(qf1, qf2, qf3, qf4, semi1, semi2, finalMatch);

              if (config.includeThirdPlace) {
                const thirdPlace = createMatch('third_place', 8, null, null);
                thirdPlace.sourceMatch1Id = semi1.id;
                thirdPlace.sourceMatch2Id = semi2.id;
                bracketMatches.push(thirdPlace);
              }
            }
          });

          return {
            tournament: {
              ...state.tournament,
              bracketMatches,
              status: 'finals_active',
              updatedAt: Date.now(),
            },
            viewMode: 'bracket', // Switch to bracket view (stub view for now)
          };
        });
      },

      generateFinals: (poolConfigs) => {
        set((state) => {
          if (!state.tournament) return state;

          const bracketMatches: BracketMatch[] = [];

          poolConfigs.forEach((config) => {
            if (config.bracketType === 'none') return;

            const poolPlayers = state.tournament!.players.filter(p => config.playerIds.includes(p.id));

            poolPlayers.sort((a, b) => {
              const aScore = a.wins * 2 + a.ties;
              const bScore = b.wins * 2 + b.ties;
              if (bScore !== aScore) return bScore - aScore;
              if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
              return b.twenties - a.twenties;
            });

            let teams: [string, string][] = [];

            if (config.manualTeams && config.manualTeams.length > 0) {
              teams = config.manualTeams;
            } else {
              const count = poolPlayers.length;
              const numTeams = count / 2;
              for (let i = 0; i < numTeams; i++) {
                teams.push([poolPlayers[i].id, poolPlayers[count - 1 - i].id]);
              }
            }

            const createMatch = (
              round: any,
              matchNum: number,
              t1: [string, string] | null,
              t2: [string, string] | null,
              nextId: string | null = null
            ): BracketMatch => ({
              id: nanoid(),
              poolId: config.poolId,
              round,
              matchNumber: matchNum,
              team1: t1,
              team2: t2,
              score1: null,
              score2: null,
              twenties1: 0,
              twenties2: 0,
              completed: false,
              winnerId: null,
              nextMatchId: nextId,
              sourceMatch1Id: null,
              sourceMatch2Id: null,
            });

            if (config.bracketType === 'final') {
              bracketMatches.push(createMatch('final', 1, teams[0], teams[1]));
            } else if (config.bracketType === 'semifinals') {
              const finalMatch = createMatch('final', 3, null, null);
              const semi1 = createMatch('semifinal', 1, teams[0], teams[3], finalMatch.id);
              const semi2 = createMatch('semifinal', 2, teams[1], teams[2], finalMatch.id);
              finalMatch.sourceMatch1Id = semi1.id;
              finalMatch.sourceMatch2Id = semi2.id;
              bracketMatches.push(semi1, semi2, finalMatch);

              if (config.includeThirdPlace) {
                const thirdPlace = createMatch('third_place', 4, null, null);
                thirdPlace.sourceMatch1Id = semi1.id;
                thirdPlace.sourceMatch2Id = semi2.id;
                bracketMatches.push(thirdPlace);
              }
            } else if (config.bracketType === 'quarterfinals') {
              const finalMatch = createMatch('final', 7, null, null);
              const semi1 = createMatch('semifinal', 5, null, null, finalMatch.id);
              const semi2 = createMatch('semifinal', 6, null, null, finalMatch.id);
              finalMatch.sourceMatch1Id = semi1.id;
              finalMatch.sourceMatch2Id = semi2.id;

              const qf1 = createMatch('quarterfinal', 1, teams[0], teams[7], semi1.id);
              const qf2 = createMatch('quarterfinal', 2, teams[3], teams[4], semi1.id);
              semi1.sourceMatch1Id = qf1.id;
              semi1.sourceMatch2Id = qf2.id;

              const qf3 = createMatch('quarterfinal', 3, teams[1], teams[6], semi2.id);
              const qf4 = createMatch('quarterfinal', 4, teams[2], teams[5], semi2.id);
              semi2.sourceMatch1Id = qf3.id;
              semi2.sourceMatch2Id = qf4.id;

              bracketMatches.push(qf1, qf2, qf3, qf4, semi1, semi2, finalMatch);

              if (config.includeThirdPlace) {
                const thirdPlace = createMatch('third_place', 8, null, null);
                thirdPlace.sourceMatch1Id = semi1.id;
                thirdPlace.sourceMatch2Id = semi2.id;
                bracketMatches.push(thirdPlace);
              }
            }
          });

          return {
            tournament: {
              ...state.tournament,
              finalsConfig: {
                enabled: true,
                poolConfigs,
                configured: true,
              },
              bracketMatches,
              status: 'finals_active',
              updatedAt: Date.now(),
            },
            viewMode: 'bracket',
          };
        });
      },

      submitBracketScore: (matchId, score1, score2, twenties1, twenties2) => {
        set((state) => {
          if (!state.tournament) return state;

          const matchIndex = state.tournament.bracketMatches.findIndex(m => m.id === matchId);
          if (matchIndex === -1) return state;

          const match = state.tournament.bracketMatches[matchIndex];

          let winnerId: string | null = null;
          let winningTeam: [string, string] | null = null;
          let losingTeam: [string, string] | null = null;

          // Determine winner/loser
          if (score1 > score2) {
            winningTeam = match.team1;
            losingTeam = match.team2;
          } else if (score2 > score1) {
            winningTeam = match.team2;
            losingTeam = match.team1;
          }

          if (winningTeam) {
            winnerId = [...winningTeam].sort().join('-');
          }

          // Update Current Match
          const updatedMatch = { ...match, score1, score2, twenties1, twenties2, completed: true, winnerId };

          let newBracketMatches = [...state.tournament.bracketMatches];
          newBracketMatches[matchIndex] = updatedMatch;

          // Propagate to Next Match (Winner)
          if (match.nextMatchId && winningTeam) {
            const nextIndex = newBracketMatches.findIndex(m => m.id === match.nextMatchId);
            if (nextIndex !== -1) {
              const nextMatch = { ...newBracketMatches[nextIndex] };
              if (nextMatch.sourceMatch1Id === match.id) {
                nextMatch.team1 = winningTeam;
              } else if (nextMatch.sourceMatch2Id === match.id) {
                nextMatch.team2 = winningTeam;
              }
              newBracketMatches[nextIndex] = nextMatch;
            }
          }

          // Propagate to Third Place Match (Loser)
          if (losingTeam) {
            // Find any match that sources this match (and is NOT the nextMatchId, though typically 3rd place is explicit)
            // Better: Find match with round 'third_place' that sources this match
            const thirdPlaceIndex = newBracketMatches.findIndex(m =>
              m.round === 'third_place' && (m.sourceMatch1Id === match.id || m.sourceMatch2Id === match.id)
            );

            if (thirdPlaceIndex !== -1) {
              const tpMatch = { ...newBracketMatches[thirdPlaceIndex] };
              if (tpMatch.sourceMatch1Id === match.id) {
                tpMatch.team1 = losingTeam;
              } else if (tpMatch.sourceMatch2Id === match.id) {
                tpMatch.team2 = losingTeam;
              }
              newBracketMatches[thirdPlaceIndex] = tpMatch;
            }
          }

          return {
            tournament: {
              ...state.tournament,
              bracketMatches: newBracketMatches,
              updatedAt: Date.now(),
            },
          };
        });
      },

      editBracketScore: (matchId, score1, score2, twenties1, twenties2) => {
        // Same as submitBracketScore for now
        get().submitBracketScore(matchId, score1, score2, twenties1, twenties2);
      },

      getFinalStandings: () => {
        const state = get();
        if (!state.tournament || !state.tournament.finalsConfig) return [];

        const standings: FinalStanding[] = [];
        const swissStandings = state.getStandings(); // Already sorted by Swiss rank
        const poolSize = state.tournament.settings.poolSize || 8;

        // Helper to find specific pool config
        const getPoolConfig = (poolId: string) =>
          state.tournament!.finalsConfig!.poolConfigs.find(c => c.poolId === poolId);

        // Process standings in chunks (Pools)
        for (let i = 0; i < swissStandings.length; i += poolSize) {
          const chunk = swissStandings.slice(i, i + poolSize);
          if (chunk.length === 0) break;

          const poolIndex = Math.floor(i / poolSize);
          const poolId = `pool-${poolIndex}`;
          const poolName = `Pool ${String.fromCharCode(65 + poolIndex)}`; // Pool A, B...
          const poolStartRank = i + 1;

          const config = getPoolConfig(poolId);
          const poolMatches = state.tournament.bracketMatches.filter(m => m.poolId === poolId);

          // If no bracket or not configured, these players just keep their relative Swiss order
          // But mapped to the pool's rank range
          if (!config || config.bracketType === 'none' || poolMatches.length === 0) {
            chunk.forEach((s, idx) => {
              standings.push({
                playerId: s.player.id,
                playerName: s.player.name,
                finalPosition: poolStartRank + idx,
                poolName: poolName,
                bracketResult: `Swiss Rank ${s.rank}`,
                swissRank: s.rank
              });
            });
            continue;
          }

          // Bracket Logic for this Pool
          const rankedPlayers = new Map<string, { rank: number, desc: string }>();
          const handledPlayers = new Set<string>();

          // 1. Final
          const finalMatch = poolMatches.find(m => m.round === 'final');
          if (finalMatch && finalMatch.completed && finalMatch.score1 !== null && finalMatch.score2 !== null) {
            const t1 = finalMatch.team1 || [];
            const t2 = finalMatch.team2 || [];
            if (finalMatch.score1 > finalMatch.score2) {
              t1.forEach(p => rankedPlayers.set(p, { rank: 1, desc: 'Champion' }));
              t2.forEach(p => rankedPlayers.set(p, { rank: 2, desc: 'Runner-up' }));
            } else {
              t2.forEach(p => rankedPlayers.set(p, { rank: 1, desc: 'Champion' }));
              t1.forEach(p => rankedPlayers.set(p, { rank: 2, desc: 'Runner-up' }));
            }
            [...t1, ...t2].forEach(p => handledPlayers.add(p));
          }

          // 2. Third Place
          const thirdPlace = poolMatches.find(m => m.round === 'third_place');
          if (thirdPlace && thirdPlace.completed && thirdPlace.score1 !== null && thirdPlace.score2 !== null) {
            const t1 = thirdPlace.team1 || [];
            const t2 = thirdPlace.team2 || [];
            const winnerRank = 3;
            const loserRank = 4;
            if (thirdPlace.score1 > thirdPlace.score2) {
              t1.forEach(p => rankedPlayers.set(p, { rank: winnerRank, desc: '3rd Place' }));
              t2.forEach(p => rankedPlayers.set(p, { rank: loserRank, desc: '4th Place' }));
            } else {
              t2.forEach(p => rankedPlayers.set(p, { rank: winnerRank, desc: '3rd Place' }));
              t1.forEach(p => rankedPlayers.set(p, { rank: loserRank, desc: '4th Place' }));
            }
            [...t1, ...t2].forEach(p => handledPlayers.add(p));
          }

          // 3. Semis Losers
          const semis = poolMatches.filter(m => m.round === 'semifinal');
          semis.forEach(m => {
            if (m.completed && m.score1 !== null && m.score2 !== null) {
              const loser = (m.score1 < m.score2) ? m.team1 : m.team2;
              if (loser) {
                loser.forEach(p => {
                  if (!handledPlayers.has(p)) {
                    rankedPlayers.set(p, { rank: 3, desc: 'Semifinalist' });
                    handledPlayers.add(p);
                  }
                });
              }
            }
          });

          // 4. Quarter Losers
          const quarters = poolMatches.filter(m => m.round === 'quarterfinal');
          quarters.forEach(m => {
            if (m.completed && m.score1 !== null && m.score2 !== null) {
              const loser = (m.score1 < m.score2) ? m.team1 : m.team2;
              if (loser) {
                loser.forEach(p => {
                  if (!handledPlayers.has(p)) {
                    rankedPlayers.set(p, { rank: 5, desc: 'Quarterfinalist' });
                    handledPlayers.add(p);
                  }
                });
              }
            }
          });

          // Build final list for this pool
          const poolResults: { pid: string, rank: number, desc: string, active: boolean, swissRank: number }[] = [];

          // Add Bracket Participants
          rankedPlayers.forEach((info, pid) => {
            // Find player in chunk to get swiss rank (or global lookup)
            const s = swissStandings.find(pl => pl.player.id === pid);
            poolResults.push({
              pid,
              rank: info.rank,
              desc: info.desc,
              active: false,
              swissRank: s?.rank || 999
            });
          });

          // Add Remaining Players (from chunk)
          chunk.forEach(s => {
            if (!handledPlayers.has(s.player.id)) {
              let rank = 100;
              let desc = 'Swiss Rank';
              let active = false;

              // Check if active in bracket (in progress)
              const activeMatch = poolMatches.find(m => !m.completed && (m.team1?.includes(s.player.id) || m.team2?.includes(s.player.id)));
              if (activeMatch) {
                active = true;
                desc = 'In Progress';
                if (activeMatch.round === 'final') rank = 1;
                else if (activeMatch.round === 'third_place') rank = 3;
                else rank = 1;
              }

              poolResults.push({
                pid: s.player.id,
                rank,
                desc,
                active,
                swissRank: s.rank
              });
            }
          });

          // Sort Pool Results
          poolResults.sort((a, b) => {
            // Rank 1..N
            if (a.rank !== b.rank) return a.rank - b.rank;
            // Tiebreaker: Swiss Rank
            return a.swissRank - b.swissRank;
          });

          // Assign final positions
          poolResults.forEach((res, idx) => {
            const pName = swissStandings.find(pl => pl.player.id === res.pid)?.player.name || 'Unknown';
            standings.push({
              playerId: res.pid,
              playerName: pName,
              finalPosition: poolStartRank + idx,
              poolName: poolName,
              bracketResult: res.desc,
              swissRank: res.swissRank
            });
          });
        }

        return standings;
      },

      getBracketMatchesByPool: (poolId) => {
        const state = get();
        if (!state.tournament) return [];
        return state.tournament.bracketMatches.filter((m) => m.poolId === poolId);
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

