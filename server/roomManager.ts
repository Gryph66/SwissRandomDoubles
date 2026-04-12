// Room management for tournament sessions

import type { Tournament, Player, Table, TournamentSettings, Match, BracketMatch, PoolBracketConfig } from '../src/types.js';
import { TournamentRoom, ConnectedPlayer, ROOM_CONFIG } from './types.js';
import { generateRoundPairings } from '../src/utils/pairingAlgorithm.js';
import { getPairingLogs } from '../src/utils/pairingLog.js';

// In-memory room storage
const rooms = new Map<string, TournamentRoom>();

// Generate a unique room code
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0, O, 1, I)
  
  let attempts = 0;
  while (attempts < 100) {
    let code = '';
    for (let i = 0; i < ROOM_CONFIG.CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    if (!rooms.has(code)) {
      return code;
    }
    attempts++;
  }
  
  throw new Error('Failed to generate unique room code');
}

// Generate unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Create a new tournament with default state
export function createTournament(name: string, totalRounds: number): Tournament {
  const now = Date.now();
  return {
    id: generateId(),
    name: name || 'New Tournament',
    players: [],
    matches: [],
    bracketMatches: [],
    tables: [],
    currentRound: 0,
    totalRounds: totalRounds || 4,
    status: 'setup',
    settings: {
      tableAssignment: false,
      playerScoreEntry: true,  // Enable by default for multi-device
      pointsPerMatch: 8,
      poolSize: 8,
      finalsEnabled: false,
      byeGameMode: 'byes_only',
      allowViewerScoreEntry: false,  // Default: only host can enter scores
      boardsAvailable: null,  // Default: unlimited boards
    },
    shareCode: '',  // Will be set when room is created
    createdAt: now,
    updatedAt: now,
  };
}

// Create a new room
export function createRoom(tournament: Tournament, hostSocketId: string): TournamentRoom {
  const code = generateRoomCode();
  tournament.shareCode = code;
  
  const room: TournamentRoom = {
    code,
    tournament,
    hostSocketId,
    connectedPlayers: new Map(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    warningsSent: false,
  };
  
  rooms.set(code, room);
  return room;
}

// Create a room with an existing tournament (for JSON import)
export function createRoomWithTournament(tournament: Tournament, hostSocketId: string): TournamentRoom {
  const code = generateRoomCode();
  
  // Update the tournament with the new room code
  const updatedTournament: Tournament = {
    ...tournament,
    shareCode: code,
    updatedAt: Date.now(),
  };
  
  const room: TournamentRoom = {
    code,
    tournament: updatedTournament,
    hostSocketId,
    connectedPlayers: new Map(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    warningsSent: false,
  };
  
  rooms.set(code, room);
  return room;
}

// Public function to recalculate stats for a room
export function recalculateStats(code: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  recalculatePlayerStats(room);
  return true;
}

// Get a room by code
export function getRoom(code: string): TournamentRoom | undefined {
  return rooms.get(code.toUpperCase());
}

// Check if room exists
export function roomExists(code: string): boolean {
  return rooms.has(code.toUpperCase());
}

// Update room activity timestamp
export function touchRoom(code: string): void {
  const room = rooms.get(code.toUpperCase());
  if (room) {
    room.lastActivity = Date.now();
    room.warningsSent = false;
  }
}

// Add a connected player to a room
export function addConnectedPlayer(
  code: string, 
  socketId: string, 
  playerName: string, 
  isHost: boolean
): ConnectedPlayer | null {
  const room = getRoom(code);
  if (!room) return null;
  
  // Try to match to an existing player by name
  let matchedPlayerId: string | null = null;
  const normalizedName = playerName.toLowerCase().trim();
  
  for (const player of room.tournament.players) {
    if (player.name.toLowerCase().trim() === normalizedName) {
      matchedPlayerId = player.id;
      break;
    }
  }
  
  const connectedPlayer: ConnectedPlayer = {
    socketId,
    playerId: matchedPlayerId,
    playerName,
    isHost,
    joinedAt: Date.now(),
  };
  
  room.connectedPlayers.set(socketId, connectedPlayer);
  touchRoom(code);
  
  return connectedPlayer;
}

// Remove a connected player
export function removeConnectedPlayer(code: string, socketId: string): void {
  const room = getRoom(code);
  if (room) {
    room.connectedPlayers.delete(socketId);
  }
}

// Get connected player count
export function getConnectedCount(code: string): number {
  const room = getRoom(code);
  return room ? room.connectedPlayers.size : 0;
}

// Check if a socket can perform host actions
export function isSocketHost(code: string, socketId: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  return room.hostSocketId === socketId;
}

// Check if a socket can submit score for a match
export function canSubmitScore(code: string, socketId: string, matchId: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  
  // Host can always submit
  if (room.hostSocketId === socketId) return true;
  
  // Find the match
  const match = room.tournament.matches.find(m => m.id === matchId);
  if (!match) return false;
  
  // Find the connected player
  const connectedPlayer = room.connectedPlayers.get(socketId);
  if (!connectedPlayer || !connectedPlayer.playerId) return false;
  
  // Check if player is in this match
  const playerId = connectedPlayer.playerId;
  const inTeam1 = match.team1.includes(playerId);
  const inTeam2 = match.team2?.includes(playerId) || false;
  
  return inTeam1 || inTeam2;
}

// Delete a room
export function deleteRoom(code: string): void {
  rooms.delete(code.toUpperCase());
}

// Get all rooms (for cleanup)
export function getAllRooms(): Map<string, TournamentRoom> {
  return rooms;
}

// ============================================
// Tournament Actions (modify room state)
// ============================================

export function addPlayer(code: string, name: string): Player | null {
  const room = getRoom(code);
  if (!room || room.tournament.status !== 'setup') return null;
  
  const player: Player = {
    id: generateId(),
    name: name.trim(),
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    twenties: 0,
    byeCount: 0,
    active: true,
  };
  
  room.tournament.players.push(player);
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return player;
}

export function removePlayer(code: string, playerId: string): boolean {
  const room = getRoom(code);
  if (!room || room.tournament.status !== 'setup') return false;
  
  const index = room.tournament.players.findIndex(p => p.id === playerId);
  if (index === -1) return false;
  
  room.tournament.players.splice(index, 1);
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
}

export function updatePlayer(code: string, playerId: string, updates: Partial<Player>): boolean {
  const room = getRoom(code);
  if (!room) return false;
  
  const player = room.tournament.players.find(p => p.id === playerId);
  if (!player) return false;
  
  Object.assign(player, updates);
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
}

export function addTable(code: string, name: string): Table | null {
  const room = getRoom(code);
  if (!room) return null;
  
  const table: Table = {
    id: generateId(),
    name: name.trim(),
    order: room.tournament.tables.length,
  };
  
  room.tournament.tables.push(table);
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return table;
}

export function removeTable(code: string, tableId: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  
  const index = room.tournament.tables.findIndex(t => t.id === tableId);
  if (index === -1) return false;
  
  room.tournament.tables.splice(index, 1);
  // Reorder remaining tables
  room.tournament.tables.forEach((t, i) => { t.order = i; });
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
}

export function updateTable(code: string, tableId: string, name: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  
  const table = room.tournament.tables.find(t => t.id === tableId);
  if (!table) return false;
  
  table.name = name.trim();
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
}

export function reorderTables(code: string, tables: Table[]): boolean {
  const room = getRoom(code);
  if (!room) return false;
  
  room.tournament.tables = tables;
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
}

export function updateSettings(code: string, settings: Partial<TournamentSettings>): boolean {
  const room = getRoom(code);
  if (!room) return false;
  
  Object.assign(room.tournament.settings, settings);
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
}

export function updateTournamentName(code: string, name: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  
  room.tournament.name = name.trim();
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
}

export function updateTotalRounds(code: string, rounds: number): boolean {
  const room = getRoom(code);
  if (!room || room.tournament.status !== 'setup') return false;
  
  room.tournament.totalRounds = Math.max(1, Math.min(20, rounds));
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
}

export function startTournament(code: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  if (room.tournament.status !== 'setup') return false;
  if (room.tournament.players.length < 4) return false;
  
  room.tournament.status = 'active';
  room.tournament.currentRound = 1;
  
  // Generate first round pairings
  const result = generateRoundPairings(
    room.tournament.players,
    room.tournament.matches,
    1,
    room.tournament.tables,
    room.tournament.settings.tableAssignment,
    room.tournament.settings.byeGameMode,
    room.tournament.settings.boardsAvailable
  );
  
  room.tournament.matches = result.matches;
  room.tournament.pairingLogs = getPairingLogs(); // Store logs for client access
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
}

// Recalculate player stats from match data
// This ensures bye selection has accurate standings
function recalculatePlayerStats(room: TournamentRoom): void {
  const matches = room.tournament.matches;
  
  // Reset all player stats
  room.tournament.players.forEach(player => {
    player.wins = 0;
    player.losses = 0;
    player.ties = 0;
    player.pointsFor = 0;
    player.pointsAgainst = 0;
    player.twenties = 0;
    player.byeCount = 0;
  });
  
  // Recalculate from completed matches
  matches.forEach(match => {
    if (!match.completed) return;
    
    if (match.isBye) {
      const player = room.tournament.players.find(p => p.id === match.team1[0]);
      if (player) {
        // Bye is always a tie (1 point) with 4-4 score
        player.ties += 1;
        player.pointsFor += match.score1 ?? 4;
        player.pointsAgainst += match.score2 ?? 4; // 4 points against for bye
        player.twenties += match.twenties1 ?? 0;
        player.byeCount += 1;
      }
    } else if (match.score1 !== null && match.score2 !== null) {
      // Team 1
      match.team1.forEach(playerId => {
        const player = room.tournament.players.find(p => p.id === playerId);
        if (player) {
          player.pointsFor += match.score1!;
          player.pointsAgainst += match.score2!;
          player.twenties += match.twenties1 ?? 0;
          if (match.score1! > match.score2!) player.wins += 1;
          else if (match.score1! < match.score2!) player.losses += 1;
          else player.ties += 1;
        }
      });
      // Team 2
      match.team2?.forEach(playerId => {
        const player = room.tournament.players.find(p => p.id === playerId);
        if (player) {
          player.pointsFor += match.score2!;
          player.pointsAgainst += match.score1!;
          player.twenties += match.twenties2 ?? 0;
          if (match.score2! > match.score1!) player.wins += 1;
          else if (match.score2! < match.score1!) player.losses += 1;
          else player.ties += 1;
        }
      });
    }
  });
}

export function generateNextRound(code: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  if (room.tournament.status !== 'active') return false;
  
  const currentRoundMatches = room.tournament.matches.filter(
    m => m.round === room.tournament.currentRound
  );
  
  // Check if all matches are completed
  const allCompleted = currentRoundMatches.every(m => m.completed);
  if (!allCompleted) return false;
  
  // Check if we've reached the total rounds
  if (room.tournament.currentRound >= room.tournament.totalRounds) {
    return false;
  }
  
  // IMPORTANT: Recalculate player stats from match data before generating pairings
  // This ensures bye selection uses accurate standings
  recalculatePlayerStats(room);
  
  room.tournament.currentRound++;
  
  const result = generateRoundPairings(
    room.tournament.players,
    room.tournament.matches,
    room.tournament.currentRound,
    room.tournament.tables,
    room.tournament.settings.tableAssignment,
    room.tournament.settings.byeGameMode,
    room.tournament.settings.boardsAvailable
  );
  
  room.tournament.matches.push(...result.matches);
  room.tournament.pairingLogs = getPairingLogs(); // Store logs for client access
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
}

export function submitScore(
  code: string,
  matchId: string,
  score1: number,
  score2: number,
  twenties1: number,
  twenties2: number
): boolean {
  const room = getRoom(code);
  if (!room) return false;
  
  const match = room.tournament.matches.find(m => m.id === matchId);
  if (!match || match.completed) return false;
  
  match.score1 = score1;
  match.score2 = score2;
  match.twenties1 = twenties1;
  match.twenties2 = twenties2;
  match.completed = true;
  
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
}

export function editScore(
  code: string,
  matchId: string,
  score1: number,
  score2: number,
  twenties1: number,
  twenties2: number
): boolean {
  const room = getRoom(code);
  if (!room) return false;
  
  const match = room.tournament.matches.find(m => m.id === matchId);
  if (!match) return false;
  
  match.score1 = score1;
  match.score2 = score2;
  match.twenties1 = twenties1;
  match.twenties2 = twenties2;
  match.completed = true;
  
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
}

// Manual tournament state update (for hosts restoring from backup or manual entry)
export function updateTournamentState(code: string, tournamentData: Tournament): boolean {
  const room = getRoom(code);
  if (!room) return false;
  
  // Preserve the room code and id
  room.tournament = {
    ...tournamentData,
    id: room.tournament.id,
    shareCode: room.tournament.shareCode,
    updatedAt: Date.now(),
  };
  
  // Recalculate player stats from the imported matches
  recalculatePlayerStats(room);
  
  touchRoom(code);
  
  return true;
}

export function completeTournament(code: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  if (room.tournament.status !== 'active') return false;

  // Recalculate stats before completing to ensure accuracy
  recalculatePlayerStats(room);

  // Check if finals are enabled
  const finalsEnabled = room.tournament.settings.finalsEnabled;
  room.tournament.status = finalsEnabled ? 'finals_setup' : 'completed';
  room.tournament.updatedAt = Date.now();
  touchRoom(code);

  return true;
}

// Undo complete tournament - reverts from completed/finals_setup back to active
export function undoCompleteTournament(code: string): boolean {
  const room = getRoom(code);
  if (!room) return false;

  // Can only undo from completed or finals_setup status
  if (room.tournament.status !== 'completed' && room.tournament.status !== 'finals_setup') {
    return false;
  }

  room.tournament.status = 'active';
  room.tournament.updatedAt = Date.now();
  touchRoom(code);

  return true;
}

export function resetTournament(code: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  
  room.tournament.matches = [];
  room.tournament.currentRound = 0;
  room.tournament.status = 'setup';
  room.tournament.players.forEach(p => {
    p.wins = 0;
    p.losses = 0;
    p.ties = 0;
    p.pointsFor = 0;
    p.pointsAgainst = 0;
    p.twenties = 0;
    p.byeCount = 0;
  });
  room.tournament.updatedAt = Date.now();
  touchRoom(code);

  return true;
}

// ============================================
// Finals / Bracket Actions
// ============================================

export function generateFinals(code: string, poolConfigs: PoolBracketConfig[]): boolean {
  const room = getRoom(code);
  if (!room) return false;

  const bracketMatches: BracketMatch[] = [];

  poolConfigs.forEach((config) => {
    if (config.bracketType === 'none') return;

    const playerMap = new Map(room.tournament.players.map(p => [p.id, p]));
    const poolPlayers = config.playerIds
      .map(id => playerMap.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

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
      round: BracketMatch['round'],
      matchNum: number,
      t1: [string, string] | null,
      t2: [string, string] | null,
      nextId: string | null = null
    ): BracketMatch => ({
      id: generateId(),
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

  room.tournament.finalsConfig = {
    enabled: true,
    poolConfigs,
    configured: true,
  };
  room.tournament.bracketMatches = bracketMatches;
  room.tournament.status = 'finals_active';
  room.tournament.updatedAt = Date.now();
  touchRoom(code);

  return true;
}

export function submitBracketScore(
  code: string,
  matchId: string,
  score1: number,
  score2: number,
  twenties1: number,
  twenties2: number
): boolean {
  const room = getRoom(code);
  if (!room) return false;

  const matchIndex = room.tournament.bracketMatches.findIndex(m => m.id === matchId);
  if (matchIndex === -1) return false;

  const match = room.tournament.bracketMatches[matchIndex];

  let winnerId: string | null = null;
  let winningTeam: [string, string] | null = null;
  let losingTeam: [string, string] | null = null;

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

  // Update current match
  match.score1 = score1;
  match.score2 = score2;
  match.twenties1 = twenties1;
  match.twenties2 = twenties2;
  match.completed = true;
  match.winnerId = winnerId;

  // Propagate winner to next match
  if (match.nextMatchId && winningTeam) {
    const nextMatch = room.tournament.bracketMatches.find(m => m.id === match.nextMatchId);
    if (nextMatch) {
      if (nextMatch.sourceMatch1Id === match.id) {
        nextMatch.team1 = winningTeam;
      } else if (nextMatch.sourceMatch2Id === match.id) {
        nextMatch.team2 = winningTeam;
      }
    }
  }

  // Propagate loser to third place match
  if (losingTeam) {
    const thirdPlace = room.tournament.bracketMatches.find(m =>
      m.round === 'third_place' && (m.sourceMatch1Id === match.id || m.sourceMatch2Id === match.id)
    );
    if (thirdPlace) {
      if (thirdPlace.sourceMatch1Id === match.id) {
        thirdPlace.team1 = losingTeam;
      } else if (thirdPlace.sourceMatch2Id === match.id) {
        thirdPlace.team2 = losingTeam;
      }
    }
  }

  room.tournament.updatedAt = Date.now();
  touchRoom(code);

  return true;
}

