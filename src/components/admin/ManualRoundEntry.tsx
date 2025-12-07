import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import type { Player } from '../../types';
import { nanoid } from 'nanoid';

interface ManualMatch {
  id: string;
  team1Player1: string;
  team1Player2: string;
  team2Player1: string;
  team2Player2: string;
  score1: string;
  score2: string;
  twenties1: string;
  twenties2: string;
  isBye: boolean;
  byePlayerId: string;
}

interface ManualRoundEntryProps {
  onClose: () => void;
}

export function ManualRoundEntry({ onClose }: ManualRoundEntryProps) {
  const { tournament, setTournament } = useTournamentStore();
  const [roundNumber, setRoundNumber] = useState(1);
  const [matches, setMatches] = useState<ManualMatch[]>([createEmptyMatch()]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!tournament) return null;

  const activePlayers = tournament.players.filter(p => p.active);

  function createEmptyMatch(): ManualMatch {
    return {
      id: nanoid(8),
      team1Player1: '',
      team1Player2: '',
      team2Player1: '',
      team2Player2: '',
      score1: '',
      score2: '',
      twenties1: '0',
      twenties2: '0',
      isBye: false,
      byePlayerId: '',
    };
  }

  const addMatch = () => {
    setMatches([...matches, createEmptyMatch()]);
  };

  const removeMatch = (id: string) => {
    if (matches.length > 1) {
      setMatches(matches.filter(m => m.id !== id));
    }
  };

  const updateMatch = (id: string, field: keyof ManualMatch, value: string | boolean) => {
    setMatches(matches.map(m => {
      if (m.id !== id) return m;
      
      const updated = { ...m, [field]: value };
      
      // If toggling bye, clear the team fields
      if (field === 'isBye' && value === true) {
        updated.team1Player1 = '';
        updated.team1Player2 = '';
        updated.team2Player1 = '';
        updated.team2Player2 = '';
        updated.score1 = '4';
        updated.score2 = '4';
      }
      
      return updated;
    }));
  };

  const getUsedPlayerIds = (excludeMatchId?: string): Set<string> => {
    const used = new Set<string>();
    matches.forEach(m => {
      if (m.id === excludeMatchId) return;
      if (m.isBye) {
        if (m.byePlayerId) used.add(m.byePlayerId);
      } else {
        if (m.team1Player1) used.add(m.team1Player1);
        if (m.team1Player2) used.add(m.team1Player2);
        if (m.team2Player1) used.add(m.team2Player1);
        if (m.team2Player2) used.add(m.team2Player2);
      }
    });
    return used;
  };

  const getAvailablePlayers = (matchId: string, currentField: keyof ManualMatch): Player[] => {
    const usedInOtherMatches = getUsedPlayerIds(matchId);
    const match = matches.find(m => m.id === matchId);
    if (!match) return [];

    // Get players used in THIS match (excluding the current field)
    const usedInThisMatch = new Set<string>();
    if (!match.isBye) {
      if (currentField !== 'team1Player1' && match.team1Player1) usedInThisMatch.add(match.team1Player1);
      if (currentField !== 'team1Player2' && match.team1Player2) usedInThisMatch.add(match.team1Player2);
      if (currentField !== 'team2Player1' && match.team2Player1) usedInThisMatch.add(match.team2Player1);
      if (currentField !== 'team2Player2' && match.team2Player2) usedInThisMatch.add(match.team2Player2);
    }

    return activePlayers.filter(p => 
      !usedInOtherMatches.has(p.id) && !usedInThisMatch.has(p.id)
    );
  };

  const validateAndSubmit = () => {
    setError(null);

    // Validate round number
    if (roundNumber < 1 || roundNumber > tournament.totalRounds) {
      setError(`Round number must be between 1 and ${tournament.totalRounds}`);
      return;
    }

    // Check if round already has matches
    const existingMatches = tournament.matches.filter(m => m.round === roundNumber);
    if (existingMatches.length > 0) {
      setError(`Round ${roundNumber} already has matches. Delete existing matches first or choose a different round.`);
      return;
    }

    // Validate each match
    for (const match of matches) {
      if (match.isBye) {
        if (!match.byePlayerId) {
          setError('Please select a player for each bye');
          return;
        }
      } else {
        if (!match.team1Player1 || !match.team1Player2 || !match.team2Player1 || !match.team2Player2) {
          setError('Please select all 4 players for each match');
          return;
        }
        if (!match.score1 || !match.score2) {
          setError('Please enter scores for each match');
          return;
        }
        const s1 = parseInt(match.score1);
        const s2 = parseInt(match.score2);
        if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
          setError('Scores must be valid positive numbers');
          return;
        }
        if (s1 + s2 !== 8) {
          setError('Scores must add up to 8 (e.g., 5-3, 4-4, 6-2)');
          return;
        }
      }
    }

    // Create match objects
    const newMatches = matches.map(m => {
      if (m.isBye) {
        return {
          id: nanoid(8),
          round: roundNumber,
          team1: [m.byePlayerId] as [string],
          team2: null,
          score1: 4,
          score2: 4,
          twenties1: parseInt(m.twenties1) || 0,
          twenties2: 0,
          tableId: null,
          completed: true,
          isBye: true,
        };
      } else {
        return {
          id: nanoid(8),
          round: roundNumber,
          team1: [m.team1Player1, m.team1Player2] as [string, string],
          team2: [m.team2Player1, m.team2Player2] as [string, string],
          score1: parseInt(m.score1),
          score2: parseInt(m.score2),
          twenties1: parseInt(m.twenties1) || 0,
          twenties2: parseInt(m.twenties2) || 0,
          tableId: null,
          completed: true,
          isBye: false,
        };
      }
    });

    // Update tournament state
    const updatedTournament = {
      ...tournament,
      matches: [...tournament.matches, ...newMatches],
      currentRound: Math.max(tournament.currentRound, roundNumber),
      status: 'active' as const,
      updatedAt: Date.now(),
    };

    setTournament(updatedTournament);
    setSuccess(true);
    
    // Reset form after short delay
    setTimeout(() => {
      setMatches([createEmptyMatch()]);
      setRoundNumber(roundNumber + 1);
      setSuccess(false);
    }, 1500);
  };

  const getPlayerName = (id: string): string => {
    const player = activePlayers.find(p => p.id === id);
    return player?.name || 'Unknown';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-bold">Manual Round Entry</h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-2xl"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Use this to manually enter match results from previous rounds. Select players for each team and enter the scores.
        </p>

        {/* Round Number */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Round Number</label>
          <input
            type="number"
            min={1}
            max={tournament.totalRounds}
            value={roundNumber}
            onChange={(e) => setRoundNumber(parseInt(e.target.value) || 1)}
            className="input w-24"
          />
          <span className="text-sm text-[var(--color-text-muted)] ml-2">
            of {tournament.totalRounds} rounds
          </span>
        </div>

        {/* Matches */}
        <div className="space-y-6">
          {matches.map((match, idx) => (
            <div key={match.id} className="card p-4 bg-[var(--color-bg-tertiary)]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Match {idx + 1}</h4>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={match.isBye}
                      onChange={(e) => updateMatch(match.id, 'isBye', e.target.checked)}
                      className="rounded"
                    />
                    Bye
                  </label>
                  {matches.length > 1 && (
                    <button
                      onClick={() => removeMatch(match.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {match.isBye ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                      Player with Bye
                    </label>
                    <select
                      value={match.byePlayerId}
                      onChange={(e) => updateMatch(match.id, 'byePlayerId', e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Select player...</option>
                      {[...getAvailablePlayers(match.id, 'byePlayerId'), 
                        ...(match.byePlayerId ? [activePlayers.find(p => p.id === match.byePlayerId)!].filter(Boolean) : [])
                      ].map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                      20s (optional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={match.twenties1}
                      onChange={(e) => updateMatch(match.id, 'twenties1', e.target.value)}
                      className="input w-20"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Team 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                        Team 1 - Player 1
                      </label>
                      <select
                        value={match.team1Player1}
                        onChange={(e) => updateMatch(match.id, 'team1Player1', e.target.value)}
                        className="input w-full"
                      >
                        <option value="">Select player...</option>
                        {[...getAvailablePlayers(match.id, 'team1Player1'),
                          ...(match.team1Player1 ? [activePlayers.find(p => p.id === match.team1Player1)!].filter(Boolean) : [])
                        ].map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                        Team 1 - Player 2
                      </label>
                      <select
                        value={match.team1Player2}
                        onChange={(e) => updateMatch(match.id, 'team1Player2', e.target.value)}
                        className="input w-full"
                      >
                        <option value="">Select player...</option>
                        {[...getAvailablePlayers(match.id, 'team1Player2'),
                          ...(match.team1Player2 ? [activePlayers.find(p => p.id === match.team1Player2)!].filter(Boolean) : [])
                        ].map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Team 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                        Team 2 - Player 1
                      </label>
                      <select
                        value={match.team2Player1}
                        onChange={(e) => updateMatch(match.id, 'team2Player1', e.target.value)}
                        className="input w-full"
                      >
                        <option value="">Select player...</option>
                        {[...getAvailablePlayers(match.id, 'team2Player1'),
                          ...(match.team2Player1 ? [activePlayers.find(p => p.id === match.team2Player1)!].filter(Boolean) : [])
                        ].map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                        Team 2 - Player 2
                      </label>
                      <select
                        value={match.team2Player2}
                        onChange={(e) => updateMatch(match.id, 'team2Player2', e.target.value)}
                        className="input w-full"
                      >
                        <option value="">Select player...</option>
                        {[...getAvailablePlayers(match.id, 'team2Player2'),
                          ...(match.team2Player2 ? [activePlayers.find(p => p.id === match.team2Player2)!].filter(Boolean) : [])
                        ].map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                        Team 1 Score
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={8}
                        value={match.score1}
                        onChange={(e) => updateMatch(match.id, 'score1', e.target.value)}
                        className="input w-full"
                        placeholder="0-8"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                        Team 2 Score
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={8}
                        value={match.score2}
                        onChange={(e) => updateMatch(match.id, 'score2', e.target.value)}
                        className="input w-full"
                        placeholder="0-8"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                        Team 1 20s
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={match.twenties1}
                        onChange={(e) => updateMatch(match.id, 'twenties1', e.target.value)}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                        Team 2 20s
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={match.twenties2}
                        onChange={(e) => updateMatch(match.id, 'twenties2', e.target.value)}
                        className="input w-full"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  {match.team1Player1 && match.team1Player2 && match.team2Player1 && match.team2Player2 && (
                    <div className="text-sm text-[var(--color-text-muted)] bg-[var(--color-bg-primary)] p-2 rounded">
                      {getPlayerName(match.team1Player1)} + {getPlayerName(match.team1Player2)}
                      {' vs '}
                      {getPlayerName(match.team2Player1)} + {getPlayerName(match.team2Player2)}
                      {match.score1 && match.score2 && (
                        <span className="ml-2 text-[var(--color-accent)]">
                          ({match.score1} - {match.score2})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Match Button */}
        <button
          onClick={addMatch}
          className="mt-4 btn btn-secondary w-full"
        >
          + Add Another Match
        </button>

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
            ✓ Round {roundNumber} added successfully!
          </div>
        )}

        {/* Submit */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={validateAndSubmit}
            className="btn btn-primary flex-1"
          >
            Add Round {roundNumber}
          </button>
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Close
          </button>
        </div>

        {/* Help Text */}
        <p className="mt-4 text-xs text-[var(--color-text-muted)]">
          Note: After adding previous rounds, you can generate the next round normally. 
          The Swiss algorithm will use the entered match history for pairings.
        </p>
      </div>
    </div>
  );
}

