import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTournamentStore } from '../store/tournamentStore';
import { RoundView } from '../components/round/RoundView';
import { Standings } from '../components/standings/Standings';
import { BracketView } from '../components/bracket/BracketView';
import { SwissAnalysis } from '../components/analysis/SwissAnalysis';
import type { Tournament } from '../types';

interface TournamentMetadata {
  name: string;
  code: string;
  archivedAt: number;
  expiresAt: number;
  playerCount: number;
  status: string;
}

export function ViewTournament() {
  const { code } = useParams<{ code: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [metadata, setMetadata] = useState<TournamentMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'rounds' | 'standings' | 'bracket' | 'analysis'>('standings');

  useEffect(() => {
    if (code) {
      fetchTournament(code);
    }
  }, [code]);

  const fetchTournament = async (tournamentCode: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/tournament/${tournamentCode}`);
      const data = await response.json();
      
      if (data.success) {
        setTournament(data.tournament);
        setMetadata(data.metadata);
        
        // Load tournament into store for components to use
        const { setTournament: setStoreTournament } = useTournamentStore.getState();
        setStoreTournament(data.tournament);
      } else {
        setError(data.message || 'Tournament not found');
      }
    } catch (err) {
      setError('Failed to load tournament. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-muted)]">Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (error || !tournament || !metadata) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-2">Tournament Not Found</h1>
          <p className="text-[var(--color-text-muted)] mb-6">
            {error || 'This tournament may have expired or been removed.'}
          </p>
          <a
            href="/"
            className="btn btn-primary"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Archive Banner */}
      <div className="bg-blue-500/20 border-b border-blue-500/50 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm text-center">
            <span className="font-semibold">📦 Archived Tournament:</span> {metadata.name}
            {' • '}
            <span className="text-[var(--color-text-muted)]">
              Archived {new Date(metadata.archivedAt).toLocaleDateString()}
            </span>
            {' • '}
            <span className="text-[var(--color-text-muted)]">
              Expires {new Date(metadata.expiresAt).toLocaleDateString()}
            </span>
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-1 overflow-x-auto">
            <button
              onClick={() => setViewMode('standings')}
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                viewMode === 'standings'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Standings
            </button>
            <button
              onClick={() => setViewMode('rounds')}
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                viewMode === 'rounds'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Round Results
            </button>
            {tournament.finalsConfig?.enabled && (
              <button
                onClick={() => setViewMode('bracket')}
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  viewMode === 'bracket'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Playoffs
              </button>
            )}
            <button
              onClick={() => setViewMode('analysis')}
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                viewMode === 'analysis'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Analysis
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4">
        {viewMode === 'standings' && <Standings />}
        {viewMode === 'rounds' && <RoundView />}
        {viewMode === 'bracket' && <BracketView />}
        {viewMode === 'analysis' && <SwissAnalysis />}
      </div>
    </div>
  );
}
