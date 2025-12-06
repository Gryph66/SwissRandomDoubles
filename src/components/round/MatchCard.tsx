import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import type { Match } from '../../types';

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const { tournament, getPlayerById, submitScore } = useTournamentStore();
  const [isEditing, setIsEditing] = useState(!match.completed);
  const [score1, setScore1] = useState<string>(match.score1?.toString() ?? '');
  const [score2, setScore2] = useState<string>(match.score2?.toString() ?? '');
  const [twenties1, setTwenties1] = useState<string>(match.twenties1?.toString() ?? '0');
  const [twenties2, setTwenties2] = useState<string>(match.twenties2?.toString() ?? '0');
  const [error, setError] = useState<string | null>(null);

  if (!tournament) return null;

  const team1Names = match.team1.map((id) => getPlayerById(id)?.name ?? 'Unknown');
  const team2Names = match.team2?.map((id) => getPlayerById(id)?.name ?? 'Unknown') ?? [];

  const table = match.tableId
    ? tournament.tables.find((t) => t.id === match.tableId)
    : null;

  const isWinnerTeam1 = match.completed && match.score1 !== null && match.score2 !== null && match.score1 > match.score2;
  const isWinnerTeam2 = match.completed && match.score1 !== null && match.score2 !== null && match.score2 > match.score1;

  const pointsPerMatch = tournament.settings.pointsPerMatch;

  const handleScoreChange = (team: 1 | 2, value: string) => {
    const numValue = parseInt(value);
    
    if (team === 1) {
      setScore1(value);
      if (!isNaN(numValue) && numValue >= 0 && numValue <= pointsPerMatch) {
        setScore2((pointsPerMatch - numValue).toString());
      }
    } else {
      setScore2(value);
      if (!isNaN(numValue) && numValue >= 0 && numValue <= pointsPerMatch) {
        setScore1((pointsPerMatch - numValue).toString());
      }
    }
    setError(null);
  };

  const handleSubmit = () => {
    const s1 = parseInt(score1);
    const s2 = parseInt(score2);
    const t1 = parseInt(twenties1) || 0;
    const t2 = parseInt(twenties2) || 0;

    if (isNaN(s1) || isNaN(s2)) {
      setError('Enter valid scores');
      return;
    }

    if (s1 + s2 !== pointsPerMatch) {
      setError(`Must total ${pointsPerMatch}`);
      return;
    }

    setError(null);
    submitScore(match.id, s1, s2, t1, t2);
    setIsEditing(false);
  };

  // Completed match display
  if (match.completed && !isEditing) {
    return (
      <div 
        className="card px-3 py-2 cursor-pointer hover:border-[var(--color-accent)]/50 transition-colors"
        onClick={() => setIsEditing(true)}
      >
        {/* Table badge */}
        {table && (
          <div className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
            {table.name}
          </div>
        )}
        
        {/* Match row */}
        <div className="flex items-center gap-2">
          {/* Team 1 */}
          <div className={`flex-1 text-right ${isWinnerTeam1 ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}`}>
            <span className="text-lg font-medium">{team1Names.join(' & ')}</span>
          </div>
          
          {/* Score */}
          <div className="flex items-center gap-1 px-2">
            <span className={`text-2xl font-mono font-bold ${isWinnerTeam1 ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}>
              {match.score1}
            </span>
            <span className="text-[var(--color-text-muted)] text-sm">-</span>
            <span className={`text-2xl font-mono font-bold ${isWinnerTeam2 ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}>
              {match.score2}
            </span>
          </div>
          
          {/* Team 2 */}
          <div className={`flex-1 ${isWinnerTeam2 ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}`}>
            <span className="text-lg font-medium">{team2Names.join(' & ')}</span>
          </div>
        </div>
      </div>
    );
  }

  // Score entry mode
  return (
    <div className="card px-3 py-2">
      {/* Table badge */}
      {table && (
        <div className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
          {table.name}
        </div>
      )}
      
      {/* Match row with inputs */}
      <div className="flex items-center gap-2">
        {/* Team 1 name */}
        <div className="flex-1 text-right">
          <span className="text-lg font-medium text-[var(--color-accent)]">{team1Names.join(' & ')}</span>
        </div>
        
        {/* Team 1 inputs */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={pointsPerMatch}
            value={score1}
            onChange={(e) => handleScoreChange(1, e.target.value)}
            placeholder="Pts"
            className="input w-14 text-center text-lg font-mono py-1 px-1"
          />
          <div className="flex flex-col items-center">
            <input
              type="number"
              min={0}
              value={twenties1}
              onChange={(e) => setTwenties1(e.target.value)}
              className="input w-10 text-center text-sm py-1 px-1"
            />
            <span className="text-[8px] text-[var(--color-text-muted)]">20s</span>
          </div>
        </div>
        
        {/* VS */}
        <span className="text-[var(--color-text-muted)] text-xs px-1">vs</span>
        
        {/* Team 2 inputs */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={pointsPerMatch}
            value={score2}
            onChange={(e) => handleScoreChange(2, e.target.value)}
            placeholder="Pts"
            className="input w-14 text-center text-lg font-mono py-1 px-1"
          />
          <div className="flex flex-col items-center">
            <input
              type="number"
              min={0}
              value={twenties2}
              onChange={(e) => setTwenties2(e.target.value)}
              className="input w-10 text-center text-sm py-1 px-1"
            />
            <span className="text-[8px] text-[var(--color-text-muted)]">20s</span>
          </div>
        </div>
        
        {/* Team 2 name */}
        <div className="flex-1">
          <span className="text-lg font-medium text-[var(--color-accent)]">{team2Names.join(' & ')}</span>
        </div>
        
        {/* Submit button */}
        <button
          onClick={handleSubmit}
          className="btn btn-primary py-1 px-3 text-sm"
        >
          Submit
        </button>
      </div>
      
      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 mt-1 text-center">{error}</div>
      )}
    </div>
  );
}
