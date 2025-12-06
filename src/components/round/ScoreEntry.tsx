import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import type { Match } from '../../types';

interface ScoreEntryProps {
  match: Match;
  onComplete: () => void;
}

export function ScoreEntry({ match, onComplete }: ScoreEntryProps) {
  const { tournament, getPlayerById, submitScore } = useTournamentStore();
  const [score1, setScore1] = useState<string>(match.score1?.toString() ?? '');
  const [score2, setScore2] = useState<string>(match.score2?.toString() ?? '');
  const [twenties1, setTwenties1] = useState<string>(match.twenties1?.toString() ?? '0');
  const [twenties2, setTwenties2] = useState<string>(match.twenties2?.toString() ?? '0');
  const [error, setError] = useState<string | null>(null);

  if (!tournament) return null;

  const team1Names = match.team1.map((id) => getPlayerById(id)?.name ?? 'Unknown');
  const team2Names = match.team2?.map((id) => getPlayerById(id)?.name ?? 'Unknown') ?? [];

  const pointsPerMatch = tournament.settings.pointsPerMatch;

  const handleSubmit = () => {
    const s1 = parseInt(score1);
    const s2 = parseInt(score2);
    const t1 = parseInt(twenties1) || 0;
    const t2 = parseInt(twenties2) || 0;

    // Validation
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

    if (t1 < 0 || t2 < 0) {
      setError('Twenties cannot be negative');
      return;
    }

    setError(null);
    submitScore(match.id, s1, s2, t1, t2);
    onComplete();
  };

  const handleScoreChange = (team: 1 | 2, value: string) => {
    const numValue = parseInt(value);
    
    if (team === 1) {
      setScore1(value);
      // Auto-fill other score if valid
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

  return (
    <div className="space-y-4">
      {/* Team 1 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">
          {team1Names.join(' & ')}
        </label>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="number"
              min={0}
              max={pointsPerMatch}
              value={score1}
              onChange={(e) => handleScoreChange(1, e.target.value)}
              placeholder="Score"
              className="input text-center text-xl font-mono"
            />
            <span className="text-xs text-[var(--color-text-muted)] block text-center mt-1">Points</span>
          </div>
          <div className="w-24">
            <input
              type="number"
              min={0}
              value={twenties1}
              onChange={(e) => setTwenties1(e.target.value)}
              placeholder="20s"
              className="input text-center"
            />
            <span className="text-xs text-[var(--color-text-muted)] block text-center mt-1">20s</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[var(--color-border)]" />
        <span className="text-xs text-[var(--color-text-muted)]">VS</span>
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>

      {/* Team 2 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">
          {team2Names.join(' & ')}
        </label>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="number"
              min={0}
              max={pointsPerMatch}
              value={score2}
              onChange={(e) => handleScoreChange(2, e.target.value)}
              placeholder="Score"
              className="input text-center text-xl font-mono"
            />
            <span className="text-xs text-[var(--color-text-muted)] block text-center mt-1">Points</span>
          </div>
          <div className="w-24">
            <input
              type="number"
              min={0}
              value={twenties2}
              onChange={(e) => setTwenties2(e.target.value)}
              placeholder="20s"
              className="input text-center"
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

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        className="btn btn-primary w-full"
      >
        {match.completed ? 'Update Score' : 'Submit Score'}
      </button>
    </div>
  );
}

