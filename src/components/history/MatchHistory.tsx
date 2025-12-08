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

  if (!tournament) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-text-muted)]">No tournament in progress</p>
      </div>
    );
  }

  // Determine which round to display
  const maxRound = tournament.status === 'completed' ? tournament.totalRounds : tournament.currentRound;
  const displayRound = viewRound ?? maxRound;
  const currentMatches = getMatchesByRound(displayRound);
  
  const regularMatches = currentMatches.filter((m) => !m.isBye);
  const byeMatches = currentMatches.filter((m) => m.isBye);
  const isCurrentRound = displayRound === tournament.currentRound && tournament.status !== 'completed';
  
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
      setViewRound(null); // Reset to show the new current round
    }
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
      <div className="flex items-center justify-between mb-3 max-w-7xl mx-auto">
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
          {isCurrentRound && tournament.status !== 'completed' && isHost && (
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

      {/* Matches Grid - More compact, more columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-w-7xl mx-auto">
        {regularMatches.map((match) => (
          <CompactMatchCard 
            key={match.id} 
            match={match} 
            isCurrentRound={isCurrentRound}
            submitScore={submitScore}
          />
        ))}
      </div>

      {/* Bye Players - Compact inline */}
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
    </div>
  );
}

// Compact Match Card for score entry
interface CompactMatchCardProps {
  match: Match;
  isCurrentRound: boolean;
  submitScore: (matchId: string, score1: number, score2: number, twenties1: number, twenties2: number) => void;
}

function CompactMatchCard({ match, isCurrentRound, submitScore }: CompactMatchCardProps) {
  const { tournament, getPlayerById } = useTournamentStore();
  const [score1, setScore1] = useState(match.score1?.toString() ?? '');
  const [score2, setScore2] = useState(match.score2?.toString() ?? '');
  const [twenties1, setTwenties1] = useState(match.twenties1 ? match.twenties1.toString() : '');
  const [twenties2, setTwenties2] = useState(match.twenties2 ? match.twenties2.toString() : '');
  const [isEditing, setIsEditing] = useState(false);

  if (!tournament) return null;

  const team1Names = match.team1.map((id) => getPlayerById(id)?.name ?? 'Unknown');
  const team2Names = match.team2?.map((id) => getPlayerById(id)?.name ?? 'Unknown') ?? [];
  
  const table = match.tableId
    ? tournament.tables.find((t) => t.id === match.tableId)
    : null;

  const isComplete = match.completed;
  const isTeam1Winner = isComplete && match.score1 !== null && match.score2 !== null && match.score1 > match.score2;
  const isTeam2Winner = isComplete && match.score1 !== null && match.score2 !== null && match.score2 > match.score1;
  
  const pointsPerMatch = tournament.settings.pointsPerMatch || 8;

  const handleScore1Change = (value: string) => {
    setScore1(value);
    const num = parseInt(value);
    if (!isNaN(num) && num >= 0 && num <= pointsPerMatch) {
      setScore2((pointsPerMatch - num).toString());
    }
  };

  const handleScore2Change = (value: string) => {
    setScore2(value);
    const num = parseInt(value);
    if (!isNaN(num) && num >= 0 && num <= pointsPerMatch) {
      setScore1((pointsPerMatch - num).toString());
    }
  };

  const handleSubmit = () => {
    const s1 = parseInt(score1) || 0;
    const s2 = parseInt(score2) || 0;
    const t1 = parseInt(twenties1) || 0;
    const t2 = parseInt(twenties2) || 0;

    if (s1 + s2 !== pointsPerMatch) {
      alert(`Scores must add up to ${pointsPerMatch}`);
      return;
    }

    submitScore(match.id, s1, s2, t1, t2);
    setIsEditing(false);
  };

  const showEntry = (isCurrentRound && !isComplete) || isEditing;

  return (
    <div
      className={`
        rounded-lg border overflow-hidden transition-all
        ${isComplete && !isEditing
          ? 'border-[var(--color-success)]' 
          : 'border-[var(--color-accent)]'
        }
      `}
    >
      {/* Compact Header */}
      <div className={`
        py-1.5 px-3 flex items-center justify-between
        ${isComplete && !isEditing ? 'bg-[var(--color-success)]' : 'bg-[var(--color-accent)]'}
      `}>
        <span className="text-sm font-bold uppercase tracking-wide text-[var(--color-bg-primary)]">
          {table?.name || `Match ${match.id.slice(-4)}`}
        </span>
        <div className="flex items-center gap-1">
          {isComplete && !isEditing && (
            <span className="text-xs text-[var(--color-bg-primary)]/80">✓</span>
          )}
          {isComplete && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-[var(--color-bg-primary)]/80 hover:text-[var(--color-bg-primary)] ml-1"
            >
              Edit
            </button>
          )}
          {isEditing && (
            <button
              onClick={() => setIsEditing(false)}
              className="text-xs text-[var(--color-bg-primary)]/80 hover:text-[var(--color-bg-primary)]"
            >
              ✕
            </button>
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
          {showEntry ? (
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
              <input
                type="number"
                min={0}
                max={pointsPerMatch}
                value={score1}
                onChange={(e) => handleScore1Change(e.target.value)}
                className="w-9 h-7 text-center text-sm font-mono font-bold rounded 
                         bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                         focus:border-[var(--color-accent)] focus:outline-none"
                placeholder="Pts"
              />
              <input
                type="number"
                min={0}
                value={twenties1}
                onChange={(e) => setTwenties1(e.target.value)}
                className="w-9 h-7 text-center text-sm font-mono rounded 
                         bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                         focus:border-[var(--color-accent)] focus:outline-none"
                placeholder="20s"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1 flex-shrink-0 ml-1">
              <span className={`text-lg font-mono font-bold ${isTeam1Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}>
                {match.score1 ?? '-'}
              </span>
              {(match.twenties1 ?? 0) > 0 && (
                <span className="text-xs text-[var(--color-accent)]">({match.twenties1})</span>
              )}
            </div>
          )}
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
          {showEntry ? (
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
              <input
                type="number"
                min={0}
                max={pointsPerMatch}
                value={score2}
                onChange={(e) => handleScore2Change(e.target.value)}
                className="w-9 h-7 text-center text-sm font-mono font-bold rounded 
                         bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                         focus:border-[var(--color-accent)] focus:outline-none"
                placeholder="Pts"
              />
              <input
                type="number"
                min={0}
                value={twenties2}
                onChange={(e) => setTwenties2(e.target.value)}
                className="w-9 h-7 text-center text-sm font-mono rounded 
                         bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                         focus:border-[var(--color-accent)] focus:outline-none"
                placeholder="20s"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1 flex-shrink-0 ml-1">
              <span className={`text-lg font-mono font-bold ${isTeam2Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}>
                {match.score2 ?? '-'}
              </span>
              {(match.twenties2 ?? 0) > 0 && (
                <span className="text-xs text-[var(--color-accent)]">({match.twenties2})</span>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        {showEntry && (
          <button
            onClick={handleSubmit}
            className="w-full btn btn-primary text-sm py-1"
          >
            {isComplete ? 'Update' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  );
}
