// Landing page - Create or Join tournament

import { useState } from 'react';

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
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  
  // Create form state
  const [tournamentName, setTournamentName] = useState('');
  const [totalRounds, setTotalRounds] = useState('4');
  const [hostName, setHostName] = useState('');
  
  // Join form state
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  
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
  
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
            Swiss Doubles
          </h1>
          <p className="text-[var(--color-text-muted)]">
            Crokinole Tournament Manager
          </p>
        </div>
        
        {/* Connection Status */}
        {isConnecting && (
          <div className="mb-6 p-4 bg-[var(--color-bg-secondary)] rounded-lg text-center">
            <div className="animate-pulse text-[var(--color-text-muted)]">
              Connecting to server...
            </div>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={onLocalMode}
              className="mt-2 text-sm text-[var(--color-accent)] hover:underline"
            >
              Continue in offline mode
            </button>
          </div>
        )}
        
        {/* Main Content */}
        {mode === 'choose' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              disabled={!isConnected && !error}
              className="w-full py-4 px-6 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] 
                       text-white font-semibold rounded-xl transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Tournament
            </button>
            
            <button
              onClick={() => setMode('join')}
              disabled={!isConnected}
              className="w-full py-4 px-6 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)]
                       text-[var(--color-text-primary)] font-semibold rounded-xl transition-colors
                       border border-[var(--color-border)]
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Tournament
            </button>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-border)]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]">
                  or
                </span>
              </div>
            </div>
            
            <button
              onClick={onLocalMode}
              className="w-full py-3 px-6 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]
                       font-medium transition-colors text-sm"
            >
              Continue in Offline Mode
              <span className="block text-xs mt-1 opacity-75">
                (Single device, no remote score entry)
              </span>
            </button>
          </div>
        )}
        
        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-4"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>
            
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Create Tournament
            </h2>
            
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Your Name (Host)
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]
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
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]
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
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]
                         rounded-lg text-[var(--color-text-primary)]
                         focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            
            <button
              type="submit"
              disabled={!isConnected || !tournamentName.trim() || !hostName.trim()}
              className="w-full py-4 px-6 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] 
                       text-white font-semibold rounded-xl transition-colors mt-6
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Tournament
            </button>
          </form>
        )}
        
        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-4"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>
            
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Join Tournament
            </h2>
            
            {joinError && (
              <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                <p className="text-red-400 text-sm">{joinError}</p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Tournament Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g., ABC123"
                maxLength={6}
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]
                         rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
                         focus:outline-none focus:border-[var(--color-accent)]
                         text-center text-2xl font-mono tracking-widest uppercase"
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
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]
                         rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
                         focus:outline-none focus:border-[var(--color-accent)]"
                required
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-2">
                Enter your name exactly as the host registered you to enable score entry for your matches.
              </p>
            </div>
            
            <button
              type="submit"
              disabled={!isConnected || !joinCode.trim() || !playerName.trim()}
              className="w-full py-4 px-6 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] 
                       text-white font-semibold rounded-xl transition-colors mt-6
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Tournament
            </button>
          </form>
        )}
        
        {/* Footer */}
        <div className="mt-8 text-center text-xs text-[var(--color-text-muted)]">
          Swiss-style doubles tournament with random partners
        </div>
      </div>
    </div>
  );
}

