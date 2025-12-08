// Shared types for Socket.IO communication

import type { Tournament, Player, Table, TournamentSettings } from '../src/types.js';

// Room/Session types
export interface ConnectedPlayer {
  socketId: string;
  playerId: string | null;  // null if spectator/host not matched to player
  playerName: string;
  isHost: boolean;
  joinedAt: number;
}

export interface TournamentRoom {
  code: string;
  tournament: Tournament;
  hostSocketId: string;
  connectedPlayers: Map<string, ConnectedPlayer>;  // socketId -> player info
  createdAt: number;
  lastActivity: number;
  warningsSent: boolean;
}

// Client -> Server events
export interface ClientToServerEvents {
  // Room management
  create_tournament: (data: { 
    tournamentName: string; 
    totalRounds: number;
    hostName: string;
  }) => void;
  
  create_tournament_with_data: (data: {
    tournament: Tournament;
  }) => void;
  
  join_tournament: (data: { 
    code: string; 
    playerName: string;
  }) => void;
  
  rejoin_tournament: (data: {
    code: string;
    playerName: string;
    isHost: boolean;
  }) => void;
  
  leave_tournament: () => void;
  
  keep_alive: () => void;
  
  // Tournament setup (host only)
  add_player: (data: { name: string }) => void;
  remove_player: (data: { playerId: string }) => void;
  update_player: (data: { playerId: string; updates: Partial<Player> }) => void;
  
  add_table: (data: { name: string }) => void;
  remove_table: (data: { tableId: string }) => void;
  update_table: (data: { tableId: string; name: string }) => void;
  reorder_tables: (data: { tables: Table[] }) => void;
  
  update_settings: (data: { settings: Partial<TournamentSettings> }) => void;
  update_tournament_name: (data: { name: string }) => void;
  update_total_rounds: (data: { rounds: number }) => void;
  
  // Tournament control (host only)
  start_tournament: () => void;
  generate_next_round: () => void;
  complete_tournament: () => void;
  reset_tournament: () => void;
  manual_update_tournament: (tournament: Tournament) => void;
  
  // Score submission (host or players in match)
  submit_score: (data: { 
    matchId: string; 
    score1: number; 
    score2: number;
    twenties1: number;
    twenties2: number;
  }) => void;
  
  edit_score: (data: { 
    matchId: string; 
    score1: number; 
    score2: number;
    twenties1: number;
    twenties2: number;
  }) => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  // Connection events
  tournament_created: (data: { 
    code: string; 
    tournament: Tournament;
  }) => void;
  
  tournament_joined: (data: { 
    tournament: Tournament;
    playerId: string | null;  // The player ID this user is matched to
    isHost: boolean;
  }) => void;
  
  join_error: (data: { 
    message: string;
  }) => void;
  
  // State updates
  state_update: (data: { 
    tournament: Tournament;
    connectedCount: number;
  }) => void;
  
  // Player connection notifications
  player_connected: (data: { 
    playerName: string;
    connectedCount: number;
  }) => void;
  
  player_disconnected: (data: { 
    playerName: string;
    connectedCount: number;
  }) => void;
  
  // Room lifecycle
  room_warning: (data: { 
    message: string;
    minutesRemaining: number;
  }) => void;
  
  room_closed: (data: { 
    message: string;
    reason: 'inactivity' | 'host_closed' | 'error';
  }) => void;
  
  // Error handling
  action_error: (data: { 
    action: string;
    message: string;
  }) => void;
  
  // Score submission feedback
  score_submitted: (data: {
    matchId: string;
    submittedBy: string;
  }) => void;
}

// Inter-server events (not used yet, but for future scaling)
export interface InterServerEvents {
  ping: () => void;
}

// Socket data attached to each socket
export interface SocketData {
  roomCode: string | null;
  playerName: string;
  playerId: string | null;
  isHost: boolean;
}

// Room configuration
export const ROOM_CONFIG = {
  INACTIVITY_TIMEOUT: 4 * 60 * 60 * 1000,  // 4 hours in ms
  WARNING_TIME: 15 * 60 * 1000,             // 15 min before cleanup
  CLEANUP_INTERVAL: 5 * 60 * 1000,          // Check every 5 minutes
  MAX_ROOMS: 50,                            // Maximum concurrent tournaments
  CODE_LENGTH: 6,                           // Tournament code length
};

