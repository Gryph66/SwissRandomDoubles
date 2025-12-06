// Socket.IO connection hook for real-time tournament sync

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Tournament } from '../types';
import type { ClientToServerEvents, ServerToClientEvents } from '../../server/types';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Determine server URL based on environment
const getServerUrl = () => {
  // In production (Replit), same origin
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  // In development, connect to the Express server
  return 'http://localhost:3001';
};

interface UseSocketOptions {
  onTournamentCreated?: (code: string, tournament: Tournament) => void;
  onTournamentJoined?: (tournament: Tournament, playerId: string | null, isHost: boolean) => void;
  onJoinError?: (message: string) => void;
  onStateUpdate?: (tournament: Tournament, connectedCount: number) => void;
  onPlayerConnected?: (playerName: string, connectedCount: number) => void;
  onPlayerDisconnected?: (playerName: string, connectedCount: number) => void;
  onRoomWarning?: (message: string, minutesRemaining: number) => void;
  onRoomClosed?: (message: string, reason: string) => void;
  onActionError?: (action: string, message: string) => void;
  onScoreSubmitted?: (matchId: string, submittedBy: string) => void;
}

interface UseSocketReturn {
  socket: TypedSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  
  // Connection
  connect: () => void;
  disconnect: () => void;
  
  // Room management
  createTournament: (tournamentName: string, totalRounds: number, hostName: string) => void;
  joinTournament: (code: string, playerName: string) => void;
  leaveTournament: () => void;
  
  // Tournament setup (host only)
  addPlayer: (name: string) => void;
  removePlayer: (playerId: string) => void;
  updatePlayer: (playerId: string, updates: Partial<any>) => void;
  addTable: (name: string) => void;
  removeTable: (tableId: string) => void;
  updateTable: (tableId: string, name: string) => void;
  reorderTables: (tables: any[]) => void;
  updateSettings: (settings: Partial<any>) => void;
  updateTournamentName: (name: string) => void;
  updateTotalRounds: (rounds: number) => void;
  
  // Tournament control (host only)
  startTournament: () => void;
  generateNextRound: () => void;
  completeTournament: () => void;
  resetTournament: () => void;
  
  // Score submission
  submitScore: (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => void;
  editScore: (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const socketRef = useRef<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store options in ref to avoid stale closures
  const optionsRef = useRef(options);
  optionsRef.current = options;
  
  // Connect to server
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    
    setIsConnecting(true);
    setError(null);
    
    const socket = io(getServerUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    }) as TypedSocket;
    
    socket.on('connect', () => {
      console.log('[Socket] Connected');
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });
    
    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err);
      setIsConnecting(false);
      setError('Failed to connect to server');
    });
    
    // Tournament events
    socket.on('tournament_created', (data) => {
      optionsRef.current.onTournamentCreated?.(data.code, data.tournament);
    });
    
    socket.on('tournament_joined', (data) => {
      optionsRef.current.onTournamentJoined?.(data.tournament, data.playerId, data.isHost);
    });
    
    socket.on('join_error', (data) => {
      optionsRef.current.onJoinError?.(data.message);
    });
    
    socket.on('state_update', (data) => {
      optionsRef.current.onStateUpdate?.(data.tournament, data.connectedCount);
    });
    
    socket.on('player_connected', (data) => {
      optionsRef.current.onPlayerConnected?.(data.playerName, data.connectedCount);
    });
    
    socket.on('player_disconnected', (data) => {
      optionsRef.current.onPlayerDisconnected?.(data.playerName, data.connectedCount);
    });
    
    socket.on('room_warning', (data) => {
      optionsRef.current.onRoomWarning?.(data.message, data.minutesRemaining);
    });
    
    socket.on('room_closed', (data) => {
      optionsRef.current.onRoomClosed?.(data.message, data.reason);
    });
    
    socket.on('action_error', (data) => {
      optionsRef.current.onActionError?.(data.action, data.message);
    });
    
    socket.on('score_submitted', (data) => {
      optionsRef.current.onScoreSubmitted?.(data.matchId, data.submittedBy);
    });
    
    socketRef.current = socket;
  }, []);
  
  // Disconnect from server
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);
  
  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    // Keep-alive ping every 2 minutes
    const keepAliveInterval = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('keep_alive');
      }
    }, 2 * 60 * 1000);
    
    return () => {
      clearInterval(keepAliveInterval);
      disconnect();
    };
  }, [connect, disconnect]);
  
  // ----------------------------------------
  // Room Management
  // ----------------------------------------
  
  const createTournament = useCallback((tournamentName: string, totalRounds: number, hostName: string) => {
    socketRef.current?.emit('create_tournament', { tournamentName, totalRounds, hostName });
  }, []);
  
  const joinTournament = useCallback((code: string, playerName: string) => {
    socketRef.current?.emit('join_tournament', { code, playerName });
  }, []);
  
  const leaveTournament = useCallback(() => {
    socketRef.current?.emit('leave_tournament');
  }, []);
  
  // ----------------------------------------
  // Tournament Setup
  // ----------------------------------------
  
  const addPlayer = useCallback((name: string) => {
    socketRef.current?.emit('add_player', { name });
  }, []);
  
  const removePlayer = useCallback((playerId: string) => {
    socketRef.current?.emit('remove_player', { playerId });
  }, []);
  
  const updatePlayer = useCallback((playerId: string, updates: Partial<any>) => {
    socketRef.current?.emit('update_player', { playerId, updates });
  }, []);
  
  const addTable = useCallback((name: string) => {
    socketRef.current?.emit('add_table', { name });
  }, []);
  
  const removeTable = useCallback((tableId: string) => {
    socketRef.current?.emit('remove_table', { tableId });
  }, []);
  
  const updateTable = useCallback((tableId: string, name: string) => {
    socketRef.current?.emit('update_table', { tableId, name });
  }, []);
  
  const reorderTables = useCallback((tables: any[]) => {
    socketRef.current?.emit('reorder_tables', { tables });
  }, []);
  
  const updateSettings = useCallback((settings: Partial<any>) => {
    socketRef.current?.emit('update_settings', { settings });
  }, []);
  
  const updateTournamentName = useCallback((name: string) => {
    socketRef.current?.emit('update_tournament_name', { name });
  }, []);
  
  const updateTotalRounds = useCallback((rounds: number) => {
    socketRef.current?.emit('update_total_rounds', { rounds });
  }, []);
  
  // ----------------------------------------
  // Tournament Control
  // ----------------------------------------
  
  const startTournament = useCallback(() => {
    socketRef.current?.emit('start_tournament');
  }, []);
  
  const generateNextRound = useCallback(() => {
    socketRef.current?.emit('generate_next_round');
  }, []);
  
  const completeTournament = useCallback(() => {
    socketRef.current?.emit('complete_tournament');
  }, []);
  
  const resetTournament = useCallback(() => {
    socketRef.current?.emit('reset_tournament');
  }, []);
  
  // ----------------------------------------
  // Score Submission
  // ----------------------------------------
  
  const submitScore = useCallback((matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => {
    socketRef.current?.emit('submit_score', { matchId, score1, score2, twenties1, twenties2 });
  }, []);
  
  const editScore = useCallback((matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => {
    socketRef.current?.emit('edit_score', { matchId, score1, score2, twenties1, twenties2 });
  }, []);
  
  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    createTournament,
    joinTournament,
    leaveTournament,
    addPlayer,
    removePlayer,
    updatePlayer,
    addTable,
    removeTable,
    updateTable,
    reorderTables,
    updateSettings,
    updateTournamentName,
    updateTotalRounds,
    startTournament,
    generateNextRound,
    completeTournament,
    resetTournament,
    submitScore,
    editScore,
  };
}

