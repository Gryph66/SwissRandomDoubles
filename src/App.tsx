import { useState, useCallback } from 'react';
import { Header } from './components/shared/Header';
import { FloatingQRCode } from './components/shared/FloatingQRCode';
import { TournamentSetup } from './components/setup/TournamentSetup';
import { RoundView } from './components/round/RoundView';
import { Standings } from './components/standings/Standings';
import { MatchHistory } from './components/history/MatchHistory';
import { SwissAnalysis } from './components/analysis/SwissAnalysis';
import { Schedule } from './components/schedule/Schedule';
import { AdminPanel } from './components/admin/AdminPanel';
import { FinalsConfig } from './components/finals/FinalsConfig';
import { BracketView } from './components/bracket/BracketView';
import { LandingPage } from './components/landing/LandingPage';
import { useTournamentStore } from './store/tournamentStore';
import { useSocket } from './hooks/useSocket';
import type { Tournament } from './types';

type AppMode = 'landing' | 'local' | 'online';

function App() {
  const {
    viewMode,
    tournament,
    setTournament,
    setIsHost,
    setConnectedPlayerId,
    setOnlineMode,
    setViewMode,
    isHost,
  } = useTournamentStore();

  const [appMode, setAppMode] = useState<AppMode>('landing');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [showQRCode, setShowQRCode] = useState(true);

  // Socket callbacks
  const handleTournamentCreated = useCallback((code: string, newTournament: Tournament) => {
    console.log('[App] Tournament created:', code);
    setTournament(newTournament);
    setIsHost(true);
    setOnlineMode(true);
    setAppMode('online');
  }, [setTournament, setIsHost, setOnlineMode]);

  const handleTournamentJoined = useCallback((newTournament: Tournament, playerId: string | null, isHostFlag: boolean) => {
    console.log('[App] Tournament joined, playerId:', playerId, 'status:', newTournament.status);
    setTournament(newTournament);
    setIsHost(isHostFlag);
    setConnectedPlayerId(playerId);
    setOnlineMode(true);
    setJoinError(null);
    setAppMode('online');

    // Navigate to appropriate page based on tournament status
    if (newTournament.status === 'active') {
      setViewMode('history'); // Go to Matches page
    } else if (newTournament.status === 'completed') {
      setViewMode('standings'); // Go to Standings page
    }
    // If status is 'setup', stay on setup (default)
  }, [setTournament, setIsHost, setConnectedPlayerId, setOnlineMode, setViewMode]);

  const handleJoinError = useCallback((message: string) => {
    console.error('[App] Join error:', message);
    setJoinError(message);
  }, []);

  const handleStateUpdate = useCallback((updatedTournament: Tournament, count: number) => {
    // Check if tournament just started or new round generated - navigate to Matches
    const prevTournament = useTournamentStore.getState().tournament;
    const justStarted = prevTournament?.status === 'setup' && updatedTournament.status === 'active';
    const newRoundGenerated = prevTournament &&
      updatedTournament.currentRound > prevTournament.currentRound;

    setTournament(updatedTournament);
    setConnectedCount(count);

    // Navigate to Matches page when tournament starts or new round begins
    if (justStarted || newRoundGenerated) {
      setViewMode('history');
    }

    // Navigate to Standings when tournament completes
    if (prevTournament?.status === 'active' && updatedTournament.status === 'completed') {
      setViewMode('standings');
    }
  }, [setTournament, setViewMode]);

  const handlePlayerConnected = useCallback((playerName: string, count: number) => {
    console.log('[App] Player connected:', playerName);
    setConnectedCount(count);
  }, []);

  const handlePlayerDisconnected = useCallback((playerName: string, count: number) => {
    console.log('[App] Player disconnected:', playerName);
    setConnectedCount(count);
  }, []);

  const handleRoomWarning = useCallback((message: string, _minutesRemaining: number) => {
    // Could show a toast notification here
    console.warn('[App] Room warning:', message);
  }, []);

  const handleRoomClosed = useCallback((message: string, _reason: string) => {
    console.warn('[App] Room closed:', message);
    setAppMode('landing');
    setTournament(null);
    setIsHost(false);
    setOnlineMode(false);
  }, [setTournament, setIsHost, setOnlineMode]);

  const handleActionError = useCallback((action: string, message: string) => {
    console.error(`[App] Action error (${action}):`, message);
    // Could show a toast notification here
  }, []);

  // Initialize socket
  const socket = useSocket({
    onTournamentCreated: handleTournamentCreated,
    onTournamentJoined: handleTournamentJoined,
    onJoinError: handleJoinError,
    onStateUpdate: handleStateUpdate,
    onPlayerConnected: handlePlayerConnected,
    onPlayerDisconnected: handlePlayerDisconnected,
    onRoomWarning: handleRoomWarning,
    onRoomClosed: handleRoomClosed,
    onActionError: handleActionError,
  });

  // Handle local mode
  const handleLocalMode = useCallback(() => {
    setAppMode('local');
    setIsHost(true);
    setOnlineMode(false);
  }, [setIsHost, setOnlineMode]);

  // Handle create tournament
  const handleCreateTournament = useCallback((tournamentName: string, totalRounds: number, hostName: string) => {
    socket.createTournament(tournamentName, totalRounds, hostName);
  }, [socket]);

  // Handle join tournament
  const handleJoinTournament = useCallback((code: string, playerName: string) => {
    setJoinError(null);
    socket.joinTournament(code, playerName);
  }, [socket]);

  // Handle loading a tournament from JSON file (goes to local/offline mode)
  const handleLoadTournament = useCallback((loadedTournament: Tournament) => {
    setTournament(loadedTournament);
    setIsHost(true);
    setOnlineMode(false);
    setAppMode('local');
    // Set view based on tournament status
    if (loadedTournament.status === 'setup') {
      setViewMode('setup');
    } else if (loadedTournament.status === 'completed') {
      setViewMode('standings');
    } else {
      setViewMode('history'); // Show match history for active tournaments
    }
  }, [setTournament, setIsHost, setOnlineMode, setViewMode]);

  // Handle loading a tournament from JSON and creating an online room
  const handleLoadTournamentOnline = useCallback((loadedTournament: Tournament) => {
    // Create a room with this tournament data
    socket.createTournamentWithData(loadedTournament);
    setAppMode('online');
    setIsHost(true);
    setOnlineMode(true);
    // Set view based on tournament status
    if (loadedTournament.status === 'setup') {
      setViewMode('setup');
    } else if (loadedTournament.status === 'completed') {
      setViewMode('standings');
    } else {
      setViewMode('schedule'); // Show schedule for active tournaments
    }
  }, [socket, setIsHost, setOnlineMode, setViewMode]);

  // Show landing page if not in a mode yet
  if (appMode === 'landing') {
    return (
      <LandingPage
        isConnected={socket.isConnected}
        isConnecting={socket.isConnecting}
        error={socket.error}
        onCreateTournament={handleCreateTournament}
        onJoinTournament={handleJoinTournament}
        onLocalMode={handleLocalMode}
        onLoadTournament={handleLoadTournament}
        onLoadTournamentOnline={handleLoadTournamentOnline}
        joinError={joinError}
      />
    );
  }

  const renderContent = () => {
    // If no tournament exists, always show setup
    if (!tournament && viewMode !== 'setup') {
      return <TournamentSetup socket={appMode === 'online' ? socket : undefined} />;
    }

    switch (viewMode) {
      case 'setup':
        return <TournamentSetup socket={appMode === 'online' ? socket : undefined} />;
      case 'schedule':
        return <Schedule socket={appMode === 'online' ? socket : undefined} />;
      case 'rounds':
        return <RoundView socket={appMode === 'online' ? socket : undefined} />;
      case 'standings':
        return <Standings />;
      case 'history':
        return <MatchHistory socket={appMode === 'online' ? socket : undefined} />;
      case 'analysis':
        return <SwissAnalysis />;
      case 'finals_config':
        return <FinalsConfig />;
      case 'bracket':
        return <BracketView />;
      case 'admin':
        return <AdminPanel
          socket={appMode === 'online' ? socket : undefined}
          showQRCode={showQRCode}
          onToggleQRCode={() => setShowQRCode(!showQRCode)}
        />;
      default:
        return <TournamentSetup socket={appMode === 'online' ? socket : undefined} />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <Header
        connectedCount={appMode === 'online' ? connectedCount : undefined}
        isOnline={appMode === 'online'}
        isConnected={socket.isConnected}
        isHost={isHost}
        showQRCode={showQRCode}
        onToggleQRCode={() => setShowQRCode(!showQRCode)}
      />
      <main className="pb-12">
        {renderContent()}
      </main>
      <FloatingQRCode
        isOnline={appMode === 'online'}
        isHost={isHost}
        isVisible={showQRCode}
        onToggle={() => setShowQRCode(!showQRCode)}
      />
    </div>
  );
}

export default App;
