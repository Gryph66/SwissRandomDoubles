import { useState, useEffect } from 'react';
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

// Store scores for all matches
interface MatchScores {
  [matchId: string]: {
    score1: string;
    score2: string;
    twenties1: string;
    twenties2: string;
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
  const [scores, setScores] = useState<MatchScores>({});
  const [editingMatches, setEditingMatches] = useState<Set<string>>(new Set());

  // Determine which round to display
  const maxRound = tournament?.status === 'completed' ? tournament.totalRounds : (tournament?.currentRound ?? 0);
  const displayRound = viewRound ?? maxRound;
  const currentMatches = tournament ? getMatchesByRound(displayRound) : [];
  
  const regularMatches = currentMatches.filter((m) => !m.isBye);
  const byeMatches = currentMatches.filter((m) => m.isBye);
  const isCurrentRound = tournament && displayRound === tournament.currentRound && tournament.status !== 'completed';
  
  // Initialize scores from match data
  useEffect(() => {
    const newScores: MatchScores = {};
    regularMatches.forEach(match => {
      newScores[match.id] = {
        score1: match.score1?.toString() ?? '',
        score2: match.score2?.toString() ?? '',
        twenties1: match.twenties1 ? match.twenties1.toString() : '',
        twenties2: match.twenties2 ? match.twenties2.toString() : '',
      };
    });
    setScores(newScores);
    setEditingMatches(new Set());
  }, [displayRound, tournament?.updatedAt]);

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
  const pointsPerMatch = tournament.settings.pointsPerMatch || 8;

  const handleNextRound = () => {
    if (isLastRound) {
      completeTournament();
      setViewMode('standings');
    } else {
      generateNextRound();
      setViewRound(null);
    }
  };

  // Update individual score
  const updateScore = (matchId: string, field: keyof MatchScores[string], value: string) => {
    setScores(prev => {
      const newScores = { ...prev };
      if (!newScores[matchId]) {
        newScores[matchId] = { score1: '', score2: '', twenties1: '', twenties2: '' };
      }
      newScores[matchId] = { ...newScores[matchId], [field]: value };
      
      // Auto-fill other score
      if (field === 'score1') {
        const num = parseInt(value);
        if (!isNaN(num) && num >= 0 && num <= pointsPerMatch) {
          newScores[matchId].score2 = (pointsPerMatch - num).toString();
        }
      } else if (field === 'score2') {
        const num = parseInt(value);
        if (!isNaN(num) && num >= 0 && num <= pointsPerMatch) {
          newScores[matchId].score1 = (pointsPerMatch - num).toString();
        }
      }
      
      return newScores;
    });
  };

  // Submit single match
  const handleSubmitSingle = (matchId: string) => {
    const matchScore = scores[matchId];
    if (!matchScore) return;
    
    const s1 = parseInt(matchScore.score1) || 0;
    const s2 = parseInt(matchScore.score2) || 0;
    const t1 = parseInt(matchScore.twenties1) || 0;
    const t2 = parseInt(matchScore.twenties2) || 0;

    if (s1 + s2 !== pointsPerMatch) {
      alert(`Scores must add up to ${pointsPerMatch}`);
      return;
    }

    submitScore(matchId, s1, s2, t1, t2);
    setEditingMatches(prev => {
      const next = new Set(prev);
      next.delete(matchId);
      return next;
    });
  };

  // Submit all pending matches
  const handleSubmitAll = () => {
    const matchesToSubmit = regularMatches.filter(m => 
      (!m.completed || editingMatches.has(m.id)) && scores[m.id]
    );
    
    // Validate all first
    for (const match of matchesToSubmit) {
      const matchScore = scores[match.id];
      if (!matchScore) continue;
      
      const s1 = parseInt(matchScore.score1) || 0;
      const s2 = parseInt(matchScore.score2) || 0;
      
      if (s1 + s2 !== pointsPerMatch) {
        alert(`${match.tableId ? tournament.tables.find(t => t.id === match.tableId)?.name : `Match ${match.id.slice(-4)}`}: Scores must add up to ${pointsPerMatch}`);
        return;
      }
    }
    
    // Submit all
    for (const match of matchesToSubmit) {
      const matchScore = scores[match.id];
      if (!matchScore) continue;
      
      const s1 = parseInt(matchScore.score1) || 0;
      const s2 = parseInt(matchScore.score2) || 0;
      const t1 = parseInt(matchScore.twenties1) || 0;
      const t2 = parseInt(matchScore.twenties2) || 0;
      
      if (s1 + s2 === pointsPerMatch) {
        submitScore(match.id, s1, s2, t1, t2);
      }
    }
    
    setEditingMatches(new Set());
  };

  // Count how many matches have valid scores entered
  const readyToSubmitCount = regularMatches.filter(m => {
    if (m.completed && !editingMatches.has(m.id)) return false;
    const matchScore = scores[m.id];
    if (!matchScore) return false;
    const s1 = parseInt(matchScore.score1);
    const s2 = parseInt(matchScore.score2);
    return !isNaN(s1) && !isNaN(s2) && s1 + s2 === pointsPerMatch;
  }).length;

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
          
          {/* Submit All Button */}
          {isCurrentRound && readyToSubmitCount > 0 && (
            <button
              onClick={handleSubmitAll}
              className="btn btn-primary text-sm px-3 py-1.5 font-semibold"
            >
  Submit All ({readyToSubmitCount})
            </button>
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
            scores={scores[match.id] || { score1: '', score2: '', twenties1: '', twenties2: '' }}
            updateScore={(field, value) => updateScore(match.id, field, value)}
            onSubmit={() => handleSubmitSingle(match.id)}
            isEditing={editingMatches.has(match.id)}
            setIsEditing={(editing) => {
              setEditingMatches(prev => {
                const next = new Set(prev);
                if (editing) next.add(match.id);
                else next.delete(match.id);
                return next;
              });
            }}
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
    </div>
  );
}

// Compact Match Card for score entry
interface CompactMatchCardProps {
  match: Match;
  isCurrentRound: boolean;
  scores: { score1: string; score2: string; twenties1: string; twenties2: string };
  updateScore: (field: 'score1' | 'score2' | 'twenties1' | 'twenties2', value: string) => void;
  onSubmit: () => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}

function CompactMatchCard({ match, isCurrentRound, scores, updateScore, onSubmit, isEditing, setIsEditing }: CompactMatchCardProps) {
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
  
  const pointsPerMatch = tournament.settings.pointsPerMatch || 8;
  const showEntry = (isCurrentRound && !isComplete) || isEditing;
  
  // Determine border and header colors
  const borderColor = isComplete && !isEditing
    ? 'border-[var(--color-success)]'
    : isSpecialMatch
      ? 'border-cyan-500'
      : 'border-[var(--color-accent)]';
  
  const headerBg = isComplete && !isEditing
    ? 'bg-[var(--color-success)]'
    : isSpecialMatch
      ? 'bg-cyan-600'
      : 'bg-[var(--color-accent)]';

  return (
    <div
      className={`
        rounded-lg border overflow-hidden transition-all
        ${borderColor}
      `}
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
                value={scores.score1}
                onChange={(e) => updateScore('score1', e.target.value)}
                className="w-9 h-7 text-center text-sm font-mono font-bold rounded 
                         bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                         focus:border-[var(--color-accent)] focus:outline-none"
                placeholder="Pts"
              />
              <input
                type="number"
                min={0}
                value={scores.twenties1}
                onChange={(e) => updateScore('twenties1', e.target.value)}
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
                value={scores.score2}
                onChange={(e) => updateScore('score2', e.target.value)}
                className="w-9 h-7 text-center text-sm font-mono font-bold rounded 
                         bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                         focus:border-[var(--color-accent)] focus:outline-none"
                placeholder="Pts"
              />
              <input
                type="number"
                min={0}
                value={scores.twenties2}
                onChange={(e) => updateScore('twenties2', e.target.value)}
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
            onClick={onSubmit}
            className="w-full btn btn-primary text-sm py-1"
          >
            {isComplete ? 'Update' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  );
}
