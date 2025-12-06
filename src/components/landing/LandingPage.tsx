// Landing page - Create or Join tournament

import { useState, useEffect } from 'react';

interface LandingPageProps {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  onCreateTournament: (tournamentName: string, totalRounds: number, hostName: string) => void;
  onJoinTournament: (code: string, playerName: string) => void;
  onLocalMode: () => void;
  joinError: string | null;
}

export function LandingPage({
  isConnected,
  isConnecting,
  error,
  onCreateTournament,
  onJoinTournament,
  onLocalMode,
  joinError,
}: LandingPageProps) {
  // Check URL for code parameter (from QR code scan)
  const urlParams = new URLSearchParams(window.location.search);
  const codeFromUrl = urlParams.get('code')?.toUpperCase() || '';
  
  // If code is in URL, go directly to join mode
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(codeFromUrl ? 'join' : 'choose');
  
  // Create form state
  const [tournamentName, setTournamentName] = useState('');
  const [totalRounds, setTotalRounds] = useState('4');
  const [hostName, setHostName] = useState('');
  
  // Join form state - pre-fill code from URL if present
  const [joinCode, setJoinCode] = useState(codeFromUrl);
  const [playerName, setPlayerName] = useState('');
  
  // Clear URL param after reading (cleaner URLs)
  useEffect(() => {
    if (codeFromUrl) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [codeFromUrl]);
  
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournamentName.trim() || !hostName.trim()) return;
    
    onCreateTournament(
      tournamentName.trim(),
      parseInt(totalRounds) || 4,
      hostName.trim()
    );
  };
  
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !playerName.trim()) return;
    
    onJoinTournament(joinCode.trim().toUpperCase(), playerName.trim());
  };
  
  // BUG FIX: Disable buttons when not connected OR when there's an error
  const isDisabledForConnection = !isConnected || !!error;
  
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {/* Logo/Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold tracking-wider text-[var(--color-text-primary)] mb-3"
              style={{ textShadow: '0 0 40px rgba(212, 175, 125, 0.3)' }}>
            SWISS RANDOM DOUBLES
          </h1>
          <p className="text-lg text-[var(--color-text-muted)] tracking-wide">
            Crokinole Tournament Manager
          </p>
        </div>
        
        {/* Connection Status */}
        {isConnecting && (
          <div className="mb-8 p-4 bg-[var(--color-bg-secondary)] rounded-lg text-center max-w-md mx-auto">
            <div className="animate-pulse text-[var(--color-text-muted)]">
              Connecting to server...
            </div>
          </div>
        )}
        
        {error && (
          <div className="mb-8 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-center max-w-md mx-auto">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={onLocalMode}
              className="mt-2 text-sm text-[var(--color-accent)] hover:underline"
            >
              Continue in offline mode
            </button>
          </div>
        )}
        
        {/* Main Content - Side by Side Cards */}
        {mode === 'choose' && (
          <>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* New Tournament Card */}
              <div 
                className={`
                  relative p-8 rounded-2xl border border-[var(--color-border)] 
                  bg-[var(--color-bg-secondary)]/50 backdrop-blur
                  transition-all duration-300 hover:border-[var(--color-accent)]/50
                  ${isDisabledForConnection ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[var(--color-bg-secondary)]'}
                `}
                onClick={() => !isDisabledForConnection && setMode('create')}
              >
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 text-[var(--color-accent)]">
                      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1" />
                      <circle cx="12" cy="12" r="2" fill="currentColor" />
                    </svg>
                  </div>
                </div>
                
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] text-center mb-3">
                  New Tournament
                </h2>
                <p className="text-[var(--color-text-muted)] text-center mb-6">
                  Create a new room for your tournament<br />with a unique code
                </p>
                
                <div className="text-center">
                  <span className="inline-block px-6 py-2 text-sm font-semibold tracking-wider text-[var(--color-accent)] 
                                 border border-[var(--color-accent)]/30 rounded-lg">
                    CREATE ROOM
                  </span>
                </div>
              </div>
              
              {/* Join Tournament Card */}
              <div 
                className={`
                  relative p-8 rounded-2xl border border-[var(--color-border)] 
                  bg-[var(--color-bg-secondary)]/50 backdrop-blur
                  transition-all duration-300 hover:border-[var(--color-accent)]/50
                  ${isDisabledForConnection ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[var(--color-bg-secondary)]'}
                `}
                onClick={() => !isDisabledForConnection && setMode('join')}
              >
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 text-[var(--color-text-secondary)]">
                      <circle cx="9" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="15" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>
                
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] text-center mb-3">
                  Join Room
                </h2>
                <p className="text-[var(--color-text-muted)] text-center mb-6">
                  Enter a room code to join an existing<br />tournament
                </p>
                
                <div className="text-center">
                  <span className="inline-block px-6 py-2 text-sm font-semibold tracking-wider text-[var(--color-text-secondary)] 
                                 border border-[var(--color-border)] rounded-lg">
                    JOIN ROOM
                  </span>
                </div>
              </div>
            </div>
            
            {/* Offline Mode */}
            <div className="text-center">
              <button
                onClick={onLocalMode}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]
                         font-medium transition-colors text-sm"
              >
                Continue in Offline Mode
                <span className="block text-xs mt-1 opacity-75">
                  (Single device, no remote score entry)
                </span>
              </button>
            </div>
            
            {/* Footer */}
            <div className="mt-12 text-center text-sm text-[var(--color-text-muted)]">
              <p>Each room runs independently with its own tournament state.</p>
              <p>Share the room code or QR code with players to sync their devices.</p>
            </div>
          </>
        )}
        
        {mode === 'create' && (
          <div className="max-w-md mx-auto">
            <form onSubmit={handleCreate} className="p-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-6"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Back
              </button>
              
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
                Create Tournament
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Your Name (Host)
                  </label>
                  <input
                    type="text"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]
                             rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
                             focus:outline-none focus:border-[var(--color-accent)]"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Tournament Name
                  </label>
                  <input
                    type="text"
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    placeholder="e.g., Saturday Night Crokinole"
                    className="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]
                             rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
                             focus:outline-none focus:border-[var(--color-accent)]"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Number of Rounds
                  </label>
                  <input
                    type="number"
                    value={totalRounds}
                    onChange={(e) => setTotalRounds(e.target.value)}
                    min="1"
                    max="20"
                    className="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]
                             rounded-lg text-[var(--color-text-primary)]
                             focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isDisabledForConnection || !tournamentName.trim() || !hostName.trim()}
                className="w-full py-4 px-6 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] 
                         text-white font-semibold rounded-xl transition-colors mt-8
                         disabled:opacity-50 disabled:cursor-not-allowed tracking-wide"
              >
                CREATE TOURNAMENT
              </button>
            </form>
          </div>
        )}
        
        {mode === 'join' && (
          <div className="max-w-md mx-auto">
            <form onSubmit={handleJoin} className="p-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-6"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Back
              </button>
              
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
                Join Tournament
              </h2>
              
              {joinError && (
                <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg mb-4">
                  <p className="text-red-400 text-sm">{joinError}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Tournament Code
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="XXXXXX"
                    maxLength={6}
                    className="w-full px-4 py-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]
                             rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
                             focus:outline-none focus:border-[var(--color-accent)]
                             text-center text-2xl font-mono tracking-[0.3em] uppercase"
                    required
                  />
                </div>
                
                <div>
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
                    required
                  />
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">
                    Enter your name exactly as the host registered you to enable score entry for your matches.
                  </p>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isDisabledForConnection || !joinCode.trim() || !playerName.trim()}
                className="w-full py-4 px-6 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] 
                         text-white font-semibold rounded-xl transition-colors mt-8
                         disabled:opacity-50 disabled:cursor-not-allowed tracking-wide"
              >
                JOIN TOURNAMENT
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
