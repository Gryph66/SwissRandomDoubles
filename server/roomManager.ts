// Room management for tournament sessions

import type { Tournament, Player, Table, TournamentSettings, Match } from '../src/types';
import { TournamentRoom, ConnectedPlayer, ROOM_CONFIG } from './types';
import { generateRoundPairings } from '../src/utils/pairingAlgorithm';

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
    tables: [],
    currentRound: 0,
    totalRounds: totalRounds || 4,
    status: 'setup',
    settings: {
      tableAssignment: false,
      playerScoreEntry: true,  // Enable by default for multi-device
      pointsPerMatch: 8,
      poolSize: 8,
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
    room.tournament.settings.tableAssignment ? room.tournament.tables : []
  );
  
  room.tournament.matches = result.matches;
  room.tournament.updatedAt = Date.now();
  touchRoom(code);
  
  return true;
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
  
  room.tournament.currentRound++;
  
  const result = generateRoundPairings(
    room.tournament.players,
    room.tournament.matches,
    room.tournament.currentRound,
    room.tournament.settings.tableAssignment ? room.tournament.tables : []
  );
  
  room.tournament.matches.push(...result.matches);
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

export function completeTournament(code: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  if (room.tournament.status !== 'active') return false;
  
  room.tournament.status = 'completed';
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

