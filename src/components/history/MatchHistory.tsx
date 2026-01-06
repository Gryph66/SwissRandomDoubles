import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import type { Match } from '../../types';

interface MatchHistoryProps {
  socket?: {
    submitScore: (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => void;
    editScore: (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => void;
    generateNextRound: () => void;
    completeTournament: () => void;
  };
}

export function MatchHistory({ socket }: MatchHistoryProps) {
  const { 
    tournament, 
    getPlayerById, 
    getMatchesByRound, 
    submitScore: localSubmitScore, 
    generateNextRound: localGenerateNextRound, 
    completeTournament: localCompleteTournament, 
    setViewMode,
    isHost,
  } = useTournamentStore();
  
  const submitScore = socket ? socket.submitScore : localSubmitScore;
  const generateNextRound = socket ? socket.generateNextRound : localGenerateNextRound;
  const completeTournament = socket ? socket.completeTournament : localCompleteTournament;
  
  const [viewRound, setViewRound] = useState<number | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  // Determine which round to display
  const maxRound = tournament?.status === 'completed' ? tournament.totalRounds : (tournament?.currentRound ?? 0);
  const displayRound = viewRound ?? maxRound;
  const currentMatches = tournament ? getMatchesByRound(displayRound) : [];
  
  const regularMatches = currentMatches.filter((m) => !m.isBye);
  const byeMatches = currentMatches.filter((m) => m.isBye);
  const isCurrentRound = tournament && displayRound === tournament.currentRound && tournament.status !== 'completed';

  if (!tournament) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-text-muted)]">No tournament in progress</p>
      </div>
    );
  }

  // Check if all matches in current round are complete
  const currentRoundMatches = getMatchesByRound(tournament.currentRound);
  const allMatchesComplete = currentRoundMatches.every((m) => m.completed);
  const pendingCount = regularMatches.filter(m => !m.completed).length;
  const isLastRound = tournament.currentRound >= tournament.totalRounds;

  const handleNextRound = () => {
    if (isLastRound) {
      completeTournament();
      setViewMode('standings');
    } else {
      generateNextRound();
      setViewRound(null);
    }
  };

  const handleSubmitScore = (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => {
    submitScore(matchId, score1, score2, twenties1, twenties2);
    setSelectedMatch(null);
  };

  if (maxRound === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-text-muted)]">No matches scheduled yet. Start the tournament first.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-2 md:p-4">
      {/* Compact Round Header */}
      <div className="flex items-center justify-between mb-3 max-w-7xl mx-auto flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewRound(Math.max(1, displayRound - 1))}
            disabled={displayRound <= 1}
            className="p-1.5 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] 
                     hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          
          <h1 className="text-xl md:text-2xl font-display font-bold text-[var(--color-accent)]">
            Round {displayRound}
          </h1>
          
          <button
            onClick={() => setViewRound(Math.min(maxRound, displayRound + 1))}
            disabled={displayRound >= maxRound}
            className="p-1.5 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] 
                     hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          
          {/* Round pills - compact */}
          <div className="hidden sm:flex items-center gap-1 ml-2">
            {Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => (
              <button
                key={round}
                onClick={() => setViewRound(round)}
                className={`w-6 h-6 rounded-full text-xs font-bold transition-all ${
                  round === displayRound 
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]' 
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {round}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status indicator */}
          {isCurrentRound && pendingCount > 0 && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
              {pendingCount} pending
            </span>
          )}
          
          {/* Next Round / Complete Button */}
          {isCurrentRound && tournament.status === 'active' && isHost && (
            <button
              onClick={handleNextRound}
              disabled={!allMatchesComplete}
              className={`btn text-sm px-3 py-1.5 font-semibold ${
                allMatchesComplete ? 'btn-primary' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
              }`}
            >
              {isLastRound ? 'Complete' : `Round ${tournament.currentRound + 1} →`}
            </button>
          )}
        </div>
      </div>

      {/* Matches Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-w-7xl mx-auto">
        {regularMatches.map((match) => (
          <CompactMatchCard 
            key={match.id} 
            match={match} 
            isCurrentRound={isCurrentRound ?? false}
            onOpenModal={() => setSelectedMatch(match)}
          />
        ))}
      </div>

      {/* Bye Players */}
      {byeMatches.length > 0 && (
        <div className="max-w-7xl mx-auto mt-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[var(--color-text-muted)]">Byes:</span>
            {byeMatches.map((match) => {
              const player = getPlayerById(match.team1[0]);
              return (
                <span
                  key={match.id}
                  className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-sm"
                >
                  {player?.name ?? 'Unknown'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Score Entry Modal */}
      {selectedMatch && (
        <ScoreEntryModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onSubmit={handleSubmitScore}
        />
      )}
    </div>
  );
}

// Compact Match Card - now clickable to open modal
interface CompactMatchCardProps {
  match: Match;
  isCurrentRound: boolean;
  onOpenModal: () => void;
}

function CompactMatchCard({ match, isCurrentRound, onOpenModal }: CompactMatchCardProps) {
  const { tournament, getPlayerById } = useTournamentStore();

  if (!tournament) return null;

  const team1Names = match.team1.map((id) => getPlayerById(id)?.name ?? 'Unknown');
  const team2Names = match.team2?.map((id) => getPlayerById(id)?.name ?? 'Unknown') ?? [];
  
  const table = match.tableId
    ? tournament.tables.find((t) => t.id === match.tableId)
    : null;

  const isComplete = match.completed;
  const isTeam1Winner = isComplete && match.score1 !== null && match.score2 !== null && match.score1 > match.score2;
  const isTeam2Winner = isComplete && match.score1 !== null && match.score2 !== null && match.score2 > match.score1;
  
  // Check if this is a special match (1v1 or 2v1)
  const isSpecialMatch = match.matchType === '1v1' || match.matchType === '2v1';
  
  const canEdit = isCurrentRound || isComplete;
  
  // Determine border and header colors
  const borderColor = isComplete
    ? 'border-[var(--color-success)]'
    : isSpecialMatch
      ? 'border-cyan-500'
      : 'border-[var(--color-accent)]';
  
  const headerBg = isComplete
    ? 'bg-[var(--color-success)]'
    : isSpecialMatch
      ? 'bg-cyan-600'
      : 'bg-[var(--color-accent)]';

  return (
    <div
      className={`
        rounded-lg border overflow-hidden transition-all
        ${borderColor}
        ${canEdit ? 'cursor-pointer hover:ring-2 hover:ring-[var(--color-accent)]/50' : ''}
      `}
      onClick={canEdit ? onOpenModal : undefined}
    >
      {/* Compact Header */}
      <div className={`
        py-1.5 px-3 flex items-center justify-between
        ${headerBg}
      `}>
        <span className="text-sm font-bold uppercase tracking-wide text-[var(--color-bg-primary)]">
          {table?.name || `Match ${match.id.slice(-4)}`}
        </span>
        <div className="flex items-center gap-1">
          {isComplete && (
            <span className="text-xs text-[var(--color-bg-primary)]/80">✓</span>
          )}
          {canEdit && (
            <span className="text-xs text-[var(--color-bg-primary)]/80 ml-1">
              {isComplete ? 'Edit' : 'Enter'}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-1.5 bg-[var(--color-bg-secondary)] space-y-1">
        {/* Team 1 Row */}
        <div className={`flex items-center justify-between rounded px-1.5 py-1 ${
          isTeam1Winner ? 'bg-[var(--color-success)]/10' : 'bg-[var(--color-bg-tertiary)]'
        }`}>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold truncate leading-tight ${isTeam1Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}`}>
              {team1Names[0]}
            </div>
            {team1Names[1] && (
              <div className={`text-sm font-semibold truncate leading-tight ${isTeam1Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}`}>
                {team1Names[1]}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-1">
            <span className={`text-lg font-mono font-bold ${isTeam1Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}>
              {match.score1 ?? '-'}
            </span>
            {(match.twenties1 ?? 0) > 0 && (
              <span className="text-xs text-[var(--color-accent)]">({match.twenties1})</span>
            )}
          </div>
        </div>

        {/* VS divider */}
        <div className="text-center text-xs text-[var(--color-text-muted)]">vs</div>

        {/* Team 2 Row */}
        <div className={`flex items-center justify-between rounded px-1.5 py-1 ${
          isTeam2Winner ? 'bg-[var(--color-success)]/10' : 'bg-[var(--color-bg-tertiary)]'
        }`}>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold truncate leading-tight ${isTeam2Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}`}>
              {team2Names[0]}
            </div>
            {team2Names[1] && (
              <div className={`text-sm font-semibold truncate leading-tight ${isTeam2Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}`}>
                {team2Names[1]}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-1">
            <span className={`text-lg font-mono font-bold ${isTeam2Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}>
              {match.score2 ?? '-'}
            </span>
            {(match.twenties2 ?? 0) > 0 && (
              <span className="text-xs text-[var(--color-accent)]">({match.twenties2})</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Score Entry Modal
interface ScoreEntryModalProps {
  match: Match;
  onClose: () => void;
  onSubmit: (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => void;
}

function ScoreEntryModal({ match, onClose, onSubmit }: ScoreEntryModalProps) {
  const { tournament, getPlayerById } = useTournamentStore();
  
  // Initialize with existing scores if editing
  const [score1, setScore1] = useState<string>(match.score1?.toString() ?? '');
  const [score2, setScore2] = useState<string>(match.score2?.toString() ?? '');
  const [twenties1, setTwenties1] = useState<string>(match.twenties1?.toString() ?? '');
  const [twenties2, setTwenties2] = useState<string>(match.twenties2?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);

  if (!tournament) return null;

  const team1Names = match.team1.map((id) => getPlayerById(id)?.name ?? 'Unknown');
  const team2Names = match.team2?.map((id) => getPlayerById(id)?.name ?? 'Unknown') ?? [];
  const pointsPerMatch = tournament.settings.pointsPerMatch || 8;
  
  const table = match.tableId
    ? tournament.tables.find((t) => t.id === match.tableId)
    : null;

  const handleScore1Change = (value: string) => {
    setScore1(value);
    const num = parseInt(value);
    if (!isNaN(num) && num >= 0 && num <= pointsPerMatch) {
      setScore2((pointsPerMatch - num).toString());
    }
    setError(null);
  };

  const handleScore2Change = (value: string) => {
    setScore2(value);
    const num = parseInt(value);
    if (!isNaN(num) && num >= 0 && num <= pointsPerMatch) {
      setScore1((pointsPerMatch - num).toString());
    }
    setError(null);
  };

  const handleSubmit = () => {
    const s1 = parseInt(score1);
    const s2 = parseInt(score2);
    const t1 = parseInt(twenties1) || 0;
    const t2 = parseInt(twenties2) || 0;

    if (isNaN(s1) || isNaN(s2)) {
      setError('Please enter valid scores');
      return;
    }

    if (s1 < 0 || s2 < 0) {
      setError('Scores cannot be negative');
      return;
    }

    if (s1 + s2 !== pointsPerMatch) {
      setError(`Scores must add up to ${pointsPerMatch} (currently ${s1 + s2})`);
      return;
    }

    onSubmit(match.id, s1, s2, t1, t2);
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-[var(--color-bg-secondary)] rounded-xl w-full max-w-sm shadow-2xl border border-[var(--color-border)]">
        {/* Header */}
        <div className="bg-[var(--color-accent)] px-4 py-3 rounded-t-xl flex items-center justify-between">
          <span className="font-bold text-[var(--color-bg-primary)]">
            {table?.name || `Match ${match.id.slice(-4)}`}
          </span>
          <button
            onClick={onClose}
            className="text-[var(--color-bg-primary)]/80 hover:text-[var(--color-bg-primary)] text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Team 1 */}
          <div className="space-y-2">
            <div className="font-semibold text-[var(--color-text-primary)]">
              {team1Names.join(' & ')}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  min={0}
                  max={pointsPerMatch}
                  value={score1}
                  onChange={(e) => handleScore1Change(e.target.value)}
                  className="input text-center text-2xl font-mono font-bold w-full"
                  placeholder="Pts"
                  autoFocus
                />
                <span className="text-xs text-[var(--color-text-muted)] block text-center mt-1">Points</span>
              </div>
              <div className="w-20">
                <input
                  type="number"
                  min={0}
                  value={twenties1}
                  onChange={(e) => setTwenties1(e.target.value)}
                  className="input text-center text-lg font-mono w-full"
                  placeholder="0"
                />
                <span className="text-xs text-[var(--color-text-muted)] block text-center mt-1">20s</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--color-border)]" />
            <span className="text-sm text-[var(--color-text-muted)]">VS</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          {/* Team 2 */}
          <div className="space-y-2">
            <div className="font-semibold text-[var(--color-text-primary)]">
              {team2Names.join(' & ')}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  min={0}
                  max={pointsPerMatch}
                  value={score2}
                  onChange={(e) => handleScore2Change(e.target.value)}
                  className="input text-center text-2xl font-mono font-bold w-full"
                  placeholder="Pts"
                />
                <span className="text-xs text-[var(--color-text-muted)] block text-center mt-1">Points</span>
              </div>
              <div className="w-20">
                <input
                  type="number"
                  min={0}
                  value={twenties2}
                  onChange={(e) => setTwenties2(e.target.value)}
                  className="input text-center text-lg font-mono w-full"
                  placeholder="0"
                />
                <span className="text-xs text-[var(--color-text-muted)] block text-center mt-1">20s</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 btn bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 btn btn-primary font-semibold"
            >
              {match.completed ? 'Update' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
