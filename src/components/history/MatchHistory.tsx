import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import type { Match } from '../../types';

export function MatchHistory() {
  const { tournament, getPlayerById, getMatchesByRound, submitScore, generateNextRound, completeTournament, setViewMode } = useTournamentStore();
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
        <p className="text-[var(--color-text-muted)] text-xl">No matches scheduled yet. Start the tournament first.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-4">
      {/* Round Header with Navigation */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-4 mb-2">
          {/* Previous Round Button */}
          <button
            onClick={() => setViewRound(Math.max(1, displayRound - 1))}
            disabled={displayRound <= 1}
            className={`
              px-4 py-2 rounded-lg text-xl font-bold transition-all
              ${displayRound <= 1 
                ? 'opacity-30 cursor-not-allowed bg-[var(--color-bg-tertiary)]' 
                : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]'
              }
            `}
          >
            &larr;
          </button>

          <h1 className="text-4xl font-display font-bold text-[var(--color-accent)]">
            Round {displayRound}
            {tournament.status === 'completed' && displayRound === tournament.totalRounds && (
              <span className="text-2xl ml-2">(Final)</span>
            )}
          </h1>

          {/* Next Round Button */}
          <button
            onClick={() => setViewRound(Math.min(maxRound, displayRound + 1))}
            disabled={displayRound >= maxRound}
            className={`
              px-4 py-2 rounded-lg text-xl font-bold transition-all
              ${displayRound >= maxRound 
                ? 'opacity-30 cursor-not-allowed bg-[var(--color-bg-tertiary)]' 
                : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]'
              }
            `}
          >
            &rarr;
          </button>
        </div>
        
        <p className="text-xl text-[var(--color-text-secondary)]">
          {tournament.status === 'completed' 
            ? 'Tournament Complete'
            : isCurrentRound 
              ? 'Find your name and go to your assigned board'
              : `Round ${displayRound} Results`
          }
        </p>
        
        {/* Round indicators */}
        <div className="flex justify-center gap-2 mt-3">
          {Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => (
            <button
              key={round}
              onClick={() => setViewRound(round)}
              className={`
                w-8 h-8 rounded-full text-sm font-bold transition-all
                ${round === displayRound 
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]' 
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }
              `}
            >
              {round}
            </button>
          ))}
        </div>
      </div>

      {/* Matches Grid - Optimized for projection */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-7xl mx-auto">
        {regularMatches.map((match) => (
          <MatchCardWithEntry 
            key={match.id} 
            match={match} 
            isCurrentRound={isCurrentRound}
          />
        ))}
      </div>

      {/* Bye Players */}
      {byeMatches.length > 0 && (
        <div className="max-w-7xl mx-auto mt-6">
          <div className="card p-4">
            <h3 className="text-xl font-semibold text-[var(--color-text-secondary)] mb-3">
              Bye This Round (No Match)
            </h3>
            <div className="flex flex-wrap gap-3">
              {byeMatches.map((match) => {
                const player = getPlayerById(match.team1[0]);
                return (
                  <div
                    key={match.id}
                    className="px-4 py-2 bg-[var(--color-bg-tertiary)] rounded-lg text-xl font-medium text-[var(--color-text-primary)]"
                  >
                    {player?.name ?? 'Unknown'}
                    <span className="text-[var(--color-text-muted)] ml-2 text-base">+4 pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Next Round / Complete Tournament Button */}
      {isCurrentRound && tournament.status !== 'completed' && (
        <div className="max-w-7xl mx-auto text-center mt-8">
          <button
            onClick={handleNextRound}
            disabled={!allMatchesComplete}
            className={`
              btn text-xl px-8 py-3 font-bold
              ${allMatchesComplete 
                ? 'btn-primary' 
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
              }
            `}
          >
            {isLastRound ? 'Complete Tournament' : `Start Round ${tournament.currentRound + 1}`}
          </button>
          {!allMatchesComplete && (
            <p className="text-[var(--color-text-muted)] mt-2">
              Complete all matches to continue
            </p>
          )}
        </div>
      )}

      {/* Footer hint */}
      {isCurrentRound && (
        <div className="text-center mt-6 text-[var(--color-text-muted)]">
          <p className="text-lg">Enter scores directly on each match card above</p>
        </div>
      )}
    </div>
  );
}

// Match Card with inline score entry
function MatchCardWithEntry({ match, isCurrentRound }: { match: Match; isCurrentRound: boolean }) {
  const { tournament, getPlayerById, submitScore } = useTournamentStore();
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

  // Auto-fill the other team's score
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
        rounded-xl border-2 overflow-hidden transition-all
        ${isComplete && !isEditing
          ? 'bg-[var(--color-success)]/5 border-[var(--color-success)]' 
          : 'bg-[var(--color-bg-secondary)] border-[var(--color-accent)]'
        }
      `}
    >
      {/* Table/Board Header */}
      <div className={`
        py-3 px-4 flex items-center justify-between
        ${isComplete && !isEditing
          ? 'bg-[var(--color-success)]' 
          : 'bg-[var(--color-accent)]'
        }
      `}>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold uppercase tracking-wide text-[var(--color-bg-primary)]">
            {table?.name || `Match ${match.id.slice(-4)}`}
          </span>
          {isComplete && !isEditing && (
            <span className="flex items-center gap-1 text-sm font-semibold text-[var(--color-bg-primary)] bg-white/20 px-2 py-0.5 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              DONE
            </span>
          )}
        </div>
        {isComplete && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm font-semibold text-[var(--color-bg-primary)] bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors"
          >
            Edit
          </button>
        )}
        {isEditing && (
          <button
            onClick={() => setIsEditing(false)}
            className="text-sm font-semibold text-[var(--color-bg-primary)] bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Entry Labels - only show when entering scores */}
      {showEntry && (
        <div className="flex justify-end px-4 pt-3 pb-1 gap-2">
          <div className="w-16 text-center text-xs font-bold text-[var(--color-text-muted)] uppercase">PTS</div>
          <div className="w-16 text-center text-xs font-bold text-[var(--color-text-muted)] uppercase">20s</div>
        </div>
      )}

      {/* Teams */}
      <div className={`px-4 ${showEntry ? 'pb-4 space-y-2' : 'p-4 space-y-3'}`}>
        {/* Team 1 */}
        <div className={`
          flex items-center justify-between rounded-lg
          ${isTeam1Winner ? 'bg-[var(--color-success)]/10' : 'bg-[var(--color-bg-tertiary)]'}
          ${showEntry ? 'p-2' : 'p-3'}
        `}>
          <div className="flex-1 min-w-0">
            <div className={`
              text-xl font-bold leading-tight truncate
              ${isTeam1Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}
            `}>
              {team1Names[0]}
            </div>
            {team1Names[1] && (
              <div className={`
                text-xl font-bold leading-tight truncate
                ${isTeam1Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}
              `}>
                {team1Names[1]}
              </div>
            )}
          </div>
          {showEntry ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                type="number"
                min={0}
                max={pointsPerMatch}
                value={score1}
                onChange={(e) => handleScore1Change(e.target.value)}
                className="w-16 h-12 text-center text-2xl font-mono font-bold rounded-lg 
                         bg-[var(--color-bg-primary)] border-2 border-[var(--color-border)]
                         focus:border-[var(--color-accent)] focus:outline-none"
              />
              <input
                type="number"
                min={0}
                value={twenties1}
                onChange={(e) => setTwenties1(e.target.value)}
                className="w-16 h-12 text-center text-2xl font-mono font-bold rounded-lg 
                         bg-[var(--color-bg-primary)] border-2 border-[var(--color-border)]
                         focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
              <span className={`
                text-4xl font-mono font-bold
                ${isTeam1Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}
              `}>
                {match.score1 ?? '-'}
              </span>
              {(match.twenties1 ?? 0) > 0 && (
                <span className="text-xl font-mono text-[var(--color-accent)]">
                  ({match.twenties1} 20s)
                </span>
              )}
            </div>
          )}
        </div>

        {/* VS */}
        <div className="text-center">
          <span className="text-sm text-[var(--color-text-muted)] font-medium">vs</span>
        </div>

        {/* Team 2 */}
        <div className={`
          flex items-center justify-between rounded-lg
          ${isTeam2Winner ? 'bg-[var(--color-success)]/10' : 'bg-[var(--color-bg-tertiary)]'}
          ${showEntry ? 'p-2' : 'p-3'}
        `}>
          <div className="flex-1 min-w-0">
            <div className={`
              text-xl font-bold leading-tight truncate
              ${isTeam2Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}
            `}>
              {team2Names[0]}
            </div>
            {team2Names[1] && (
              <div className={`
                text-xl font-bold leading-tight truncate
                ${isTeam2Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}
              `}>
                {team2Names[1]}
              </div>
            )}
          </div>
          {showEntry ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                type="number"
                min={0}
                max={pointsPerMatch}
                value={score2}
                onChange={(e) => handleScore2Change(e.target.value)}
                className="w-16 h-12 text-center text-2xl font-mono font-bold rounded-lg 
                         bg-[var(--color-bg-primary)] border-2 border-[var(--color-border)]
                         focus:border-[var(--color-accent)] focus:outline-none"
              />
              <input
                type="number"
                min={0}
                value={twenties2}
                onChange={(e) => setTwenties2(e.target.value)}
                className="w-16 h-12 text-center text-2xl font-mono font-bold rounded-lg 
                         bg-[var(--color-bg-primary)] border-2 border-[var(--color-border)]
                         focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
              <span className={`
                text-4xl font-mono font-bold
                ${isTeam2Winner ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}
              `}>
                {match.score2 ?? '-'}
              </span>
              {(match.twenties2 ?? 0) > 0 && (
                <span className="text-xl font-mono text-[var(--color-accent)]">
                  ({match.twenties2} 20s)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        {showEntry && (
          <button
            onClick={handleSubmit}
            className="w-full btn btn-primary text-lg py-2 mt-2"
          >
            {isComplete ? 'Update Score' : 'Submit Score'}
          </button>
        )}
      </div>
    </div>
  );
}
