// Express + Socket.IO server for Swiss Doubles Tournament

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import type { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData,
  TournamentRoom 
} from './types.js';
import { ROOM_CONFIG } from './types.js';
import * as RoomManager from './roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? false  // Same origin in production
      : true,  // Allow all origins in development for local network testing
    methods: ['GET', 'POST'],
  },
});

// Server start time for uptime calculation
const serverStartTime = Date.now();

// Helper function to format duration in human-readable form
function formatDuration(ms: number): string {
  if (ms < 0) return '0s';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

// ============================================
// API Routes (must be BEFORE static file serving)
// ============================================

// API endpoint to check server status
app.get('/api/status', (_req, res) => {
  const rooms = RoomManager.getAllRooms();
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    uptime: process.uptime(),
    uptimeFormatted: formatUptime(process.uptime()),
    startedAt: new Date(serverStartTime).toISOString(),
  });
});

// API endpoint to get detailed room information
app.get('/api/rooms', (_req, res) => {
  const rooms = RoomManager.getAllRooms();
  const now = Date.now();
  
  const roomsData = Array.from(rooms.entries()).map(([code, room]) => {
    // Get connected player details
    const connectedPlayersArray = Array.from(room.connectedPlayers.values()).map(cp => ({
      playerName: cp.playerName,
      isHost: cp.isHost,
      matchedToPlayer: cp.playerId !== null,
      joinedAt: new Date(cp.joinedAt).toISOString(),
      connectionDuration: formatDuration(now - cp.joinedAt),
    }));

    return {
      code,
      tournamentName: room.tournament.name,
      status: room.tournament.status,
      currentRound: room.tournament.currentRound,
      totalRounds: room.tournament.totalRounds,
      playerCount: room.tournament.players.filter(p => p.active).length,
      matchCount: room.tournament.matches.length,
      connectedCount: room.connectedPlayers.size,
      connectedPlayers: connectedPlayersArray,
      createdAt: new Date(room.createdAt).toISOString(),
      lastActivity: new Date(room.lastActivity).toISOString(),
      openDuration: formatDuration(now - room.createdAt),
      idleTime: formatDuration(now - room.lastActivity),
      idleMs: now - room.lastActivity,
      warningsSent: room.warningsSent,
      timeUntilCleanup: formatDuration(Math.max(0, ROOM_CONFIG.INACTIVITY_TIMEOUT - (now - room.lastActivity))),
    };
  });

  res.json({
    config: {
      inactivity_timeout_hours: ROOM_CONFIG.INACTIVITY_TIMEOUT / (60 * 60 * 1000),
      warning_time_minutes: ROOM_CONFIG.WARNING_TIME / (60 * 1000),
      cleanup_interval_minutes: ROOM_CONFIG.CLEANUP_INTERVAL / (60 * 1000),
      max_rooms: ROOM_CONFIG.MAX_ROOMS,
      code_length: ROOM_CONFIG.CODE_LENGTH,
    },
    server: {
      uptime: process.uptime(),
      uptimeFormatted: formatUptime(process.uptime()),
      startedAt: new Date(serverStartTime).toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
      },
    },
    total_rooms: rooms.size,
    rooms: roomsData,
  });
});

// ============================================
// Static file serving (AFTER API routes)
// ============================================

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // After compilation, __dirname is dist-server/server/, so we need to go up 2 levels to project root
  const distPath = path.join(__dirname, '../../dist');
  app.use(express.static(distPath));
  
  // Handle client-side routing (Express 5 syntax) - MUST be last
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ============================================
// Socket.IO Event Handlers
// ============================================

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);
  
  // Initialize socket data
  socket.data.roomCode = null;
  socket.data.playerName = '';
  socket.data.playerId = null;
  socket.data.isHost = false;
  
  // ----------------------------------------
  // Room Management
  // ----------------------------------------
  
  socket.on('create_tournament', (data) => {
    const { tournamentName, totalRounds, hostName } = data;
    
    console.log(`[Create] Host "${hostName}" creating tournament "${tournamentName}"`);
    
    // Create tournament and room
    const tournament = RoomManager.createTournament(tournamentName, totalRounds);
    const room = RoomManager.createRoom(tournament, socket.id);
    
    // Add host as connected player
    RoomManager.addConnectedPlayer(room.code, socket.id, hostName, true);
    
    // Join socket to room
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerName = hostName;
    socket.data.isHost = true;
    
    // Send response
    socket.emit('tournament_created', {
      code: room.code,
      tournament: room.tournament,
    });
    
    console.log(`[Create] Tournament created with code: ${room.code}`);
  });
  
  // Create tournament with existing data (from JSON import)
  socket.on('create_tournament_with_data', (data) => {
    const { tournament } = data;
    
    console.log(`[Create] Creating room for imported tournament "${tournament.name}"`);
    
    // Create room with the provided tournament data
    const room = RoomManager.createRoomWithTournament(tournament, socket.id);
    
    // Add host as connected player
    RoomManager.addConnectedPlayer(room.code, socket.id, 'Host', true);
    
    // Recalculate player stats from matches
    RoomManager.recalculateStats(room.code);
    
    // Join socket to room
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerName = 'Host';
    socket.data.isHost = true;
    
    // Send response
    socket.emit('tournament_created', {
      code: room.code,
      tournament: room.tournament,
    });
    
    console.log(`[Create] Tournament "${tournament.name}" loaded with code: ${room.code}`);
  });
  
  socket.on('join_tournament', (data) => {
    const { code, playerName } = data;
    const normalizedCode = code.toUpperCase().trim();
    
    console.log(`[Join] "${playerName}" attempting to join ${normalizedCode}`);
    
    const room = RoomManager.getRoom(normalizedCode);
    
    if (!room) {
      socket.emit('join_error', {
        message: `Tournament "${normalizedCode}" not found. Please check the code and try again.`,
      });
      return;
    }
    
    // Add as connected player (will try to match to existing player)
    const connectedPlayer = RoomManager.addConnectedPlayer(
      normalizedCode, 
      socket.id, 
      playerName, 
      false
    );
    
    if (!connectedPlayer) {
      socket.emit('join_error', {
        message: 'Failed to join tournament.',
      });
      return;
    }
    
    // Join socket to room
    socket.join(normalizedCode);
    socket.data.roomCode = normalizedCode;
    socket.data.playerName = playerName;
    socket.data.playerId = connectedPlayer.playerId;
    socket.data.isHost = false;
    
    // Send tournament state to joining player
    socket.emit('tournament_joined', {
      tournament: room.tournament,
      playerId: connectedPlayer.playerId,
      isHost: false,
    });
    
    // Notify others in the room
    socket.to(normalizedCode).emit('player_connected', {
      playerName,
      connectedCount: RoomManager.getConnectedCount(normalizedCode),
    });
    
    console.log(`[Join] "${playerName}" joined ${normalizedCode}${connectedPlayer.playerId ? ` as player ${connectedPlayer.playerId}` : ' as spectator'}`);
  });
  
  socket.on('leave_tournament', () => {
    leaveCurrentRoom(socket);
  });
  
  // Handle reconnection - rejoin tournament after socket disconnect/reconnect
  socket.on('rejoin_tournament', (data) => {
    const { code, playerName, isHost } = data;
    const normalizedCode = code.toUpperCase().trim();
    
    console.log(`[Rejoin] "${playerName}" attempting to rejoin ${normalizedCode} as ${isHost ? 'host' : 'player'}`);
    
    const room = RoomManager.getRoom(normalizedCode);
    
    if (!room) {
      console.log(`[Rejoin] Tournament ${normalizedCode} not found`);
      socket.emit('join_error', {
        message: `Tournament "${normalizedCode}" no longer exists. It may have been closed due to inactivity.`,
      });
      return;
    }
    
    // For host rejoin, verify they were the original host
    let actuallyHost = isHost;
    if (isHost) {
      // Check if there's currently no host connected, or the host name matches
      const existingHost = Array.from(room.connectedPlayers.values()).find(p => p.isHost);
      if (existingHost && existingHost.socketId !== socket.id) {
        // There's already a different host connected - join as regular player
        console.log(`[Rejoin] Host already connected, joining as player`);
        actuallyHost = false;
      }
    }
    
    // Add as connected player
    const connectedPlayer = RoomManager.addConnectedPlayer(
      normalizedCode, 
      socket.id, 
      playerName, 
      actuallyHost
    );
    
    if (!connectedPlayer) {
      socket.emit('join_error', {
        message: 'Failed to rejoin tournament.',
      });
      return;
    }
    
    // Update host socket ID if rejoining as host
    if (actuallyHost) {
      room.hostSocketId = socket.id;
    }
    
    // Join socket to room
    socket.join(normalizedCode);
    socket.data.roomCode = normalizedCode;
    socket.data.playerName = playerName;
    socket.data.playerId = connectedPlayer.playerId;
    socket.data.isHost = actuallyHost;
    
    // Send tournament state to rejoining player
    socket.emit('tournament_joined', {
      tournament: room.tournament,
      playerId: connectedPlayer.playerId,
      isHost: actuallyHost,
    });
    
    // Notify others in the room
    socket.to(normalizedCode).emit('player_connected', {
      playerName,
      connectedCount: RoomManager.getConnectedCount(normalizedCode),
    });
    
    console.log(`[Rejoin] "${playerName}" rejoined ${normalizedCode} as ${actuallyHost ? 'host' : 'player'}`);
  });
  
  socket.on('keep_alive', () => {
    if (socket.data.roomCode) {
      RoomManager.touchRoom(socket.data.roomCode);
    }
  });
  
  // ----------------------------------------
  // Tournament Setup (Host Only)
  // ----------------------------------------
  
  socket.on('add_player', (data) => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'add_player', message: 'Not authorized' });
      return;
    }
    
    const player = RoomManager.addPlayer(socket.data.roomCode, data.name);
    if (player) {
      broadcastState(socket.data.roomCode);
    }
  });
  
  socket.on('remove_player', (data) => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'remove_player', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.removePlayer(socket.data.roomCode, data.playerId)) {
      broadcastState(socket.data.roomCode);
    }
  });
  
  socket.on('update_player', (data) => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'update_player', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.updatePlayer(socket.data.roomCode, data.playerId, data.updates)) {
      broadcastState(socket.data.roomCode);
    }
  });
  
  socket.on('add_table', (data) => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'add_table', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.addTable(socket.data.roomCode, data.name)) {
      broadcastState(socket.data.roomCode);
    }
  });
  
  socket.on('remove_table', (data) => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'remove_table', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.removeTable(socket.data.roomCode, data.tableId)) {
      broadcastState(socket.data.roomCode);
    }
  });
  
  socket.on('update_table', (data) => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'update_table', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.updateTable(socket.data.roomCode, data.tableId, data.name)) {
      broadcastState(socket.data.roomCode);
    }
  });
  
  socket.on('reorder_tables', (data) => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'reorder_tables', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.reorderTables(socket.data.roomCode, data.tables)) {
      broadcastState(socket.data.roomCode);
    }
  });
  
  socket.on('update_settings', (data) => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'update_settings', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.updateSettings(socket.data.roomCode, data.settings)) {
      broadcastState(socket.data.roomCode);
    }
  });
  
  socket.on('update_tournament_name', (data) => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'update_tournament_name', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.updateTournamentName(socket.data.roomCode, data.name)) {
      broadcastState(socket.data.roomCode);
    }
  });
  
  socket.on('update_total_rounds', (data) => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'update_total_rounds', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.updateTotalRounds(socket.data.roomCode, data.rounds)) {
      broadcastState(socket.data.roomCode);
    }
  });
  
  // ----------------------------------------
  // Tournament Control (Host Only)
  // ----------------------------------------
  
  socket.on('start_tournament', () => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'start_tournament', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.startTournament(socket.data.roomCode)) {
      broadcastState(socket.data.roomCode);
      console.log(`[Tournament] Started: ${socket.data.roomCode}`);
    } else {
      socket.emit('action_error', { action: 'start_tournament', message: 'Cannot start tournament. Need at least 4 players.' });
    }
  });
  
  socket.on('generate_next_round', () => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'generate_next_round', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.generateNextRound(socket.data.roomCode)) {
      broadcastState(socket.data.roomCode);
      console.log(`[Tournament] Next round generated: ${socket.data.roomCode}`);
    } else {
      socket.emit('action_error', { action: 'generate_next_round', message: 'Cannot generate next round. Complete all current matches first.' });
    }
  });
  
  socket.on('complete_tournament', () => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'complete_tournament', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.completeTournament(socket.data.roomCode)) {
      broadcastState(socket.data.roomCode);
      console.log(`[Tournament] Completed: ${socket.data.roomCode}`);
    }
  });
  
  socket.on('reset_tournament', () => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'reset_tournament', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.resetTournament(socket.data.roomCode)) {
      broadcastState(socket.data.roomCode);
      console.log(`[Tournament] Reset: ${socket.data.roomCode}`);
    }
  });
  
  // ----------------------------------------
  // Score Submission (Host or Match Players)
  // ----------------------------------------
  
  socket.on('submit_score', (data) => {
    if (!socket.data.roomCode) {
      socket.emit('action_error', { action: 'submit_score', message: 'Not in a tournament' });
      return;
    }
    
    // Check permission
    if (!RoomManager.canSubmitScore(socket.data.roomCode, socket.id, data.matchId)) {
      socket.emit('action_error', { action: 'submit_score', message: 'You can only submit scores for matches you are playing in' });
      return;
    }
    
    if (RoomManager.submitScore(
      socket.data.roomCode,
      data.matchId,
      data.score1,
      data.score2,
      data.twenties1,
      data.twenties2
    )) {
      broadcastState(socket.data.roomCode);
      
      // Notify everyone about the score submission
      io.to(socket.data.roomCode).emit('score_submitted', {
        matchId: data.matchId,
        submittedBy: socket.data.playerName,
      });
      
      console.log(`[Score] Submitted by "${socket.data.playerName}" for match ${data.matchId}`);
    }
  });
  
  socket.on('edit_score', (data) => {
    if (!socket.data.roomCode) {
      socket.emit('action_error', { action: 'edit_score', message: 'Not in a tournament' });
      return;
    }
    
    // Check permission (same as submit)
    if (!RoomManager.canSubmitScore(socket.data.roomCode, socket.id, data.matchId)) {
      socket.emit('action_error', { action: 'edit_score', message: 'You can only edit scores for matches you are playing in' });
      return;
    }
    
    if (RoomManager.editScore(
      socket.data.roomCode,
      data.matchId,
      data.score1,
      data.score2,
      data.twenties1,
      data.twenties2
    )) {
      broadcastState(socket.data.roomCode);
      console.log(`[Score] Edited by "${socket.data.playerName}" for match ${data.matchId}`);
    }
  });
  
  // ----------------------------------------
  // Manual Tournament Update (for hosts only)
  // ----------------------------------------
  
  socket.on('manual_update_tournament', (tournament) => {
    if (!socket.data.roomCode || !socket.data.isHost) {
      socket.emit('action_error', { action: 'manual_update_tournament', message: 'Not authorized' });
      return;
    }
    
    if (RoomManager.updateTournamentState(socket.data.roomCode, tournament)) {
      broadcastState(socket.data.roomCode);
      console.log(`[Tournament] Manual update by "${socket.data.playerName}" - ${tournament.matches?.length || 0} matches`);
    } else {
      socket.emit('action_error', { action: 'manual_update_tournament', message: 'Failed to update tournament' });
    }
  });
  
  // ----------------------------------------
  // Disconnect
  // ----------------------------------------
  
  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    leaveCurrentRoom(socket);
  });
});

// ============================================
// Helper Functions
// ============================================

function leaveCurrentRoom(socket: any) {
  if (!socket.data.roomCode) return;
  
  const code = socket.data.roomCode;
  const playerName = socket.data.playerName;
  
  RoomManager.removeConnectedPlayer(code, socket.id);
  socket.leave(code);
  
  // Notify others
  socket.to(code).emit('player_disconnected', {
    playerName,
    connectedCount: RoomManager.getConnectedCount(code),
  });
  
  // Clear socket data
  socket.data.roomCode = null;
  socket.data.playerName = '';
  socket.data.playerId = null;
  socket.data.isHost = false;
  
  console.log(`[Leave] "${playerName}" left ${code}`);
}

function broadcastState(code: string) {
  const room = RoomManager.getRoom(code);
  if (!room) return;
  
  io.to(code).emit('state_update', {
    tournament: room.tournament,
    connectedCount: room.connectedPlayers.size,
  });
}

// ============================================
// Room Cleanup
// ============================================

function cleanupInactiveRooms() {
  const now = Date.now();
  const rooms = RoomManager.getAllRooms();
  
  for (const [code, room] of rooms) {
    const inactiveTime = now - room.lastActivity;
    
    // Check if room should be deleted
    if (inactiveTime >= ROOM_CONFIG.INACTIVITY_TIMEOUT) {
      console.log(`[Cleanup] Deleting inactive room: ${code}`);
      
      // Notify connected clients
      io.to(code).emit('room_closed', {
        message: 'This tournament has been closed due to inactivity.',
        reason: 'inactivity',
      });
      
      RoomManager.deleteRoom(code);
    }
    // Check if warning should be sent
    else if (
      inactiveTime >= ROOM_CONFIG.INACTIVITY_TIMEOUT - ROOM_CONFIG.WARNING_TIME &&
      !room.warningsSent
    ) {
      const minutesRemaining = Math.ceil(
        (ROOM_CONFIG.INACTIVITY_TIMEOUT - inactiveTime) / 60000
      );
      
      io.to(code).emit('room_warning', {
        message: `This tournament will close in ${minutesRemaining} minutes due to inactivity.`,
        minutesRemaining,
      });
      
      room.warningsSent = true;
      console.log(`[Cleanup] Warning sent to ${code}: ${minutesRemaining} min remaining`);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupInactiveRooms, ROOM_CONFIG.CLEANUP_INTERVAL);

// ============================================
// Start Server
// ============================================

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Listen on all interfaces for network access

httpServer.listen(Number(PORT), HOST, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║     Swiss Doubles Tournament Server            ║
║     Running on http://${HOST}:${PORT}              ║
║     Network: http://<your-ip>:${PORT}            ║
╚════════════════════════════════════════════════╝
  `);
});

