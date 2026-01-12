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
  const [isJoining, setIsJoining] = useState(false); // Start false - wait for name entry
  const [playerName, setPlayerName] = useState('');
  const [hasSubmittedName, setHasSubmittedName] = useState(false);

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

  // Track if we've already sent the join request
  const [joinSent, setJoinSent] = useState(false);

  // Clear any existing tournament state when mounting the join page
  // This ensures we don't get stuck with stale localStorage data
  useEffect(() => {
    // Clear tournament so we can join fresh
    setTournament(null);
    setOnlineMode(true); // We're joining online
    setJoinSent(false); // Reset join sent flag
  }, [setTournament, setOnlineMode]);

  // Join tournament when user has submitted their name and socket is connected
  useEffect(() => {
    if (code && socket.isConnected && hasSubmittedName && !joinSent) {
      console.log('[JoinTournament] Joining tournament with code:', code, 'name:', playerName);
      socket.joinTournament(code.toUpperCase(), playerName.trim());
      setJoinSent(true); // Prevent duplicate join attempts
      setIsJoining(true); // Now we're actually joining
    }
  }, [code, socket.isConnected, hasSubmittedName, joinSent, playerName, socket.joinTournament]);

  // Timeout for join - if no response after 10 seconds, show error
  useEffect(() => {
    if (joinSent && isJoining) {
      const timeout = setTimeout(() => {
        console.error('[JoinTournament] Join timeout - no response from server');
        setJoinError('Connection timed out. The tournament may not exist or the server may be unavailable.');
        setIsJoining(false);
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [joinSent, isJoining]);

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

  // Handle name form submission
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      setHasSubmittedName(true);
    }
  };

  // Show connecting state
  if (socket.isConnecting) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-muted)]">Connecting to server...</p>
        </div>
      </div>
    );
  }

  // Show name entry form before joining
  if (!hasSubmittedName && !joinError && !socket.error) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-wider text-[var(--color-text-primary)] mb-2">
              Join Tournament
            </h1>
            <p className="text-[var(--color-text-muted)]">
              Code: <span className="font-mono text-lg text-[var(--color-accent)]">{code?.toUpperCase()}</span>
            </p>
          </div>

          <form onSubmit={handleNameSubmit} className="p-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name exactly as registered"
                className="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]
                         rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
                         focus:outline-none focus:border-[var(--color-accent)]"
                autoFocus
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-2">
                Enter your name exactly as the host registered you to enable score entry for your matches.
              </p>
            </div>

            <button
              type="submit"
              disabled={!playerName.trim() || !socket.isConnected}
              className="w-full py-4 px-6 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]
                       text-white font-semibold rounded-xl transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed tracking-wide"
            >
              JOIN TOURNAMENT
            </button>

            <div className="mt-4 text-center">
              <a
                href="/"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] text-sm"
              >
                ← Back to Home
              </a>
            </div>
          </form>

          {/* Connection status */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs">
            {socket.isConnected ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-green-400">Connected</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-red-400">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while joining
  if (isJoining) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-muted)]">Joining tournament {code}...</p>
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
                setIsJoining(false);
                setHasSubmittedName(false);
                setJoinSent(false);
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
        isReconnecting={socket.isReconnecting}
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
