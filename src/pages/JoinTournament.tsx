import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/shared/Header';
import { FloatingQRCode } from '../components/shared/FloatingQRCode';
import { TournamentSetup } from '../components/setup/TournamentSetup';
import { RoundView } from '../components/round/RoundView';
import { Standings } from '../components/standings/Standings';
import { MatchHistory } from '../components/history/MatchHistory';
import { SwissAnalysis } from '../components/analysis/SwissAnalysis';
import { Schedule } from '../components/schedule/Schedule';
import { AdminPanel } from '../components/admin/AdminPanel';
import { FinalsConfig } from '../components/finals/FinalsConfig';
import { BracketView } from '../components/bracket/BracketView';
import { useTournamentStore } from '../store/tournamentStore';
import { useSocket } from '../hooks/useSocket';
import type { Tournament } from '../types';

export function JoinTournament() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const {
    viewMode,
    tournament,
    setTournament,
    setIsHost,
    setConnectedPlayerId,
    setOnlineMode,
    setViewMode,
  } = useTournamentStore();

  const [connectedCount, setConnectedCount] = useState(0);
  const [showQRCode, setShowQRCode] = useState(false); // Viewers don't need QR code
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(true);

  // Socket callbacks
  const handleTournamentJoined = (newTournament: Tournament, playerId: string | null, isHostFlag: boolean) => {
    console.log('[JoinTournament] Tournament joined as viewer');
    setTournament(newTournament);
    setIsHost(isHostFlag);
    setConnectedPlayerId(playerId);
    setOnlineMode(true);
    setJoinError(null);
    setIsJoining(false);

    // Navigate to appropriate page based on tournament status
    if (newTournament.status === 'active') {
      setViewMode('schedule'); // Go to Schedule page to see upcoming matches
    } else if (newTournament.status === 'completed') {
      setViewMode('standings'); // Go to Standings page
    }
  };

  const handleJoinError = (message: string) => {
    console.error('[JoinTournament] Join error:', message);
    setJoinError(message);
    setIsJoining(false);
  };

  const handleStateUpdate = (updatedTournament: Tournament, count: number) => {
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
  };

  const handlePlayerConnected = (playerName: string, count: number) => {
    console.log('[JoinTournament] Player connected:', playerName);
    setConnectedCount(count);
  };

  const handlePlayerDisconnected = (playerName: string, count: number) => {
    console.log('[JoinTournament] Player disconnected:', playerName);
    setConnectedCount(count);
  };

  const handleRoomClosed = (message: string, _reason: string) => {
    console.warn('[JoinTournament] Room closed:', message);
    // Redirect to home page
    navigate('/');
  };

  const handleActionError = (action: string, message: string) => {
    console.error(`[JoinTournament] Action error (${action}):`, message);
  };

  // Initialize socket with callbacks
  const socket = useSocket({
    onTournamentJoined: handleTournamentJoined,
    onJoinError: handleJoinError,
    onStateUpdate: handleStateUpdate,
    onPlayerConnected: handlePlayerConnected,
    onPlayerDisconnected: handlePlayerDisconnected,
    onRoomClosed: handleRoomClosed,
    onActionError: handleActionError,
  });

  // Auto-join tournament when code is available and socket is connected
  useEffect(() => {
    if (code && socket.isConnected && isJoining && !tournament) {
      console.log('[JoinTournament] Auto-joining tournament with code:', code);
      // Join as viewer (no player name)
      socket.joinTournament(code.toUpperCase(), '');
    }
  }, [code, socket.isConnected, isJoining, tournament, socket]);

  const renderContent = () => {
    // If no tournament exists, always show setup (read-only for viewers)
    if (!tournament && viewMode !== 'setup') {
      return <TournamentSetup socket={socket} />;
    }

    switch (viewMode) {
      case 'setup':
        return <TournamentSetup socket={socket} />;
      case 'schedule':
        return <Schedule socket={socket} />;
      case 'rounds':
        return <RoundView socket={socket} />;
      case 'standings':
        return <Standings />;
      case 'history':
        return <MatchHistory socket={socket} />;
      case 'analysis':
        return <SwissAnalysis />;
      case 'finals_config':
        return <FinalsConfig />;
      case 'bracket':
        return <BracketView />;
      case 'admin':
        return <AdminPanel
          socket={socket}
          showQRCode={showQRCode}
          onToggleQRCode={() => setShowQRCode(!showQRCode)}
        />;
      default:
        return <TournamentSetup socket={socket} />;
    }
  };

  // Show loading state while connecting
  if (socket.isConnecting || isJoining) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-muted)]">
            {socket.isConnecting ? 'Connecting to server...' : `Joining tournament ${code}...`}
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (joinError || socket.error) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--color-bg-secondary)] border border-red-500/50 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-2">Connection Error</h1>
          <p className="text-[var(--color-text-muted)] mb-6">
            {joinError || socket.error || 'Failed to join tournament'}
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setJoinError(null);
                setIsJoining(true);
              }}
              className="btn btn-primary w-full"
            >
              Try Again
            </button>
            <a
              href="/"
              className="btn btn-secondary w-full block"
            >
              Go to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Show tournament interface
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <Header
        connectedCount={connectedCount}
        isOnline={true}
        isConnected={socket.isConnected}
        isHost={false} // Viewers are never hosts
        showQRCode={showQRCode}
        onToggleQRCode={() => setShowQRCode(!showQRCode)}
      />
      <main className="pb-12">
        {renderContent()}
      </main>
      <FloatingQRCode
        isOnline={true}
        isHost={false}
        isVisible={showQRCode}
        onToggle={() => setShowQRCode(!showQRCode)}
      />
    </div>
  );
}
