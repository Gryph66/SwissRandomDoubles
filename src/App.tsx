import { useState, useCallback, useEffect } from 'react';
import { Header } from './components/shared/Header';
import { TournamentSetup } from './components/setup/TournamentSetup';
import { RoundView } from './components/round/RoundView';
import { Standings } from './components/standings/Standings';
import { MatchHistory } from './components/history/MatchHistory';
import { SwissAnalysis } from './components/analysis/SwissAnalysis';
import { AdminPanel } from './components/admin/AdminPanel';
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
    isHost,
    connectedPlayerId,
  } = useTournamentStore();
  
  const [appMode, setAppMode] = useState<AppMode>('landing');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [connectedCount, setConnectedCount] = useState(0);
  
  // Socket callbacks
  const handleTournamentCreated = useCallback((code: string, newTournament: Tournament) => {
    console.log('[App] Tournament created:', code);
    setTournament(newTournament);
    setIsHost(true);
    setOnlineMode(true);
    setAppMode('online');
  }, [setTournament, setIsHost, setOnlineMode]);
  
  const handleTournamentJoined = useCallback((newTournament: Tournament, playerId: string | null, isHostFlag: boolean) => {
    console.log('[App] Tournament joined, playerId:', playerId);
    setTournament(newTournament);
    setIsHost(isHostFlag);
    setConnectedPlayerId(playerId);
    setOnlineMode(true);
    setJoinError(null);
    setAppMode('online');
  }, [setTournament, setIsHost, setConnectedPlayerId, setOnlineMode]);
  
  const handleJoinError = useCallback((message: string) => {
    console.error('[App] Join error:', message);
    setJoinError(message);
  }, []);
  
  const handleStateUpdate = useCallback((updatedTournament: Tournament, count: number) => {
    setTournament(updatedTournament);
    setConnectedCount(count);
  }, [setTournament]);
  
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
      case 'rounds':
        return <RoundView socket={appMode === 'online' ? socket : undefined} />;
      case 'standings':
        return <Standings />;
      case 'history':
        return <MatchHistory socket={appMode === 'online' ? socket : undefined} />;
      case 'analysis':
        return <SwissAnalysis />;
      case 'admin':
        return <AdminPanel socket={appMode === 'online' ? socket : undefined} />;
      default:
        return <TournamentSetup socket={appMode === 'online' ? socket : undefined} />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <Header 
        connectedCount={appMode === 'online' ? connectedCount : undefined}
        isOnline={appMode === 'online'}
        isHost={isHost}
      />
      <main className="pb-12">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
