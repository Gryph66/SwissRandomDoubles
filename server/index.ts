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
} from './types';
import { ROOM_CONFIG } from './types';
import * as RoomManager from './roomManager';

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
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],  // Vite dev server
    methods: ['GET', 'POST'],
  },
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  
  // Handle client-side routing
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// API endpoint to check server status
app.get('/api/status', (_req, res) => {
  const rooms = RoomManager.getAllRooms();
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    uptime: process.uptime(),
  });
});

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

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║     Swiss Doubles Tournament Server            ║
║     Running on port ${PORT}                        ║
╚════════════════════════════════════════════════╝
  `);
});

