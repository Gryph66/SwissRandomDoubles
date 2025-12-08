import { useState, useMemo } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import type { Player, Match } from '../../types';
import { nanoid } from 'nanoid';

interface MatchEntry {
  id: string;
  team1Player1: string;
  team1Player2: string;
  team2Player1: string;
  team2Player2: string;
  score1: string;
  score2: string;
  twenties1: string;
  twenties2: string;
}

interface ManualRoundEntryProps {
  onClose: () => void;
}

export function ManualRoundEntry({ onClose }: ManualRoundEntryProps) {
  const { tournament, setTournament } = useTournamentStore();
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const activePlayers = useMemo(() => 
    tournament?.players.filter(p => p.active) || [], 
    [tournament?.players]
  );

  // Calculate how many matches are needed (players / 4, rounded down)
  const matchCount = Math.floor(activePlayers.length / 4);
  // Calculate how many players get a bye
  const byeCount = activePlayers.length % 4;

  // Get existing matches for a round
  const getExistingMatches = (round: number): Match[] => {
    return tournament?.matches.filter(m => m.round === round) || [];
  };

  // Check if a round has data
  const roundHasData = (round: number): boolean => {
    return getExistingMatches(round).length > 0;
  };

  // Load round data into the form
  const loadRound = (round: number) => {
    setSelectedRound(round);
    setError(null);
    setSuccess(null);
    setShowDeleteConfirm(false);

    const existingMatches = getExistingMatches(round);
    
    if (existingMatches.length > 0) {
      // Load existing matches (non-bye matches only)
      const regularMatches = existingMatches.filter(m => !m.isBye);
      const loadedMatches: MatchEntry[] = regularMatches.map(m => ({
        id: m.id,
        team1Player1: m.team1[0] || '',
        team1Player2: m.team1[1] || '',
        team2Player1: m.team2?.[0] || '',
        team2Player2: m.team2?.[1] || '',
        score1: m.score1?.toString() || '',
        score2: m.score2?.toString() || '',
        // Only show 20s if they have a value > 0, otherwise leave empty for easier entry
        twenties1: m.twenties1 ? m.twenties1.toString() : '',
        twenties2: m.twenties2 ? m.twenties2.toString() : '',
      }));
      setMatches(loadedMatches);
    } else {
      // Create empty match slots
      createEmptyForm();
    }
  };
  
  // Create empty form with correct number of match slots
  const createEmptyForm = () => {
    const emptyMatches: MatchEntry[] = Array(matchCount).fill(null).map(() => ({
      id: nanoid(8),
      team1Player1: '',
      team1Player2: '',
      team2Player1: '',
      team2Player2: '',
      score1: '',
      score2: '',
      twenties1: '',
      twenties2: '',
    }));
    setMatches(emptyMatches);
  };

  const updateMatch = (id: string, field: keyof MatchEntry, value: string) => {
    setMatches(matches.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // Get all players used in the current form
  const getUsedPlayerIds = (): Set<string> => {
    const used = new Set<string>();
    matches.forEach(m => {
      if (m.team1Player1) used.add(m.team1Player1);
      if (m.team1Player2) used.add(m.team1Player2);
      if (m.team2Player1) used.add(m.team2Player1);
      if (m.team2Player2) used.add(m.team2Player2);
    });
    return used;
  };

  // Get available players for a dropdown (excluding already used ones)
  const getAvailablePlayers = (matchId: string, currentField: keyof MatchEntry): Player[] => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return [];

    const usedElsewhere = new Set<string>();
    matches.forEach(m => {
      if (m.id === matchId) return;
      if (m.team1Player1) usedElsewhere.add(m.team1Player1);
      if (m.team1Player2) usedElsewhere.add(m.team1Player2);
      if (m.team2Player1) usedElsewhere.add(m.team2Player1);
      if (m.team2Player2) usedElsewhere.add(m.team2Player2);
    });

    const usedInThisMatch = new Set<string>();
    if (currentField !== 'team1Player1' && match.team1Player1) usedInThisMatch.add(match.team1Player1);
    if (currentField !== 'team1Player2' && match.team1Player2) usedInThisMatch.add(match.team1Player2);
    if (currentField !== 'team2Player1' && match.team2Player1) usedInThisMatch.add(match.team2Player1);
    if (currentField !== 'team2Player2' && match.team2Player2) usedInThisMatch.add(match.team2Player2);

    return activePlayers.filter(p => 
      !usedElsewhere.has(p.id) && !usedInThisMatch.has(p.id)
    );
  };

  // Get players who will get a bye (not assigned to any match)
  const getByePlayers = (): Player[] => {
    const used = getUsedPlayerIds();
    return activePlayers.filter(p => !used.has(p.id));
  };

  const getPlayerName = (id: string): string => {
    return activePlayers.find(p => p.id === id)?.name || 'Unknown';
  };

  // Calculate average 20s from existing completed matches
  const getAverageTwenties = (): number => {
    if (!tournament) return 0;
    const completedMatches = tournament.matches.filter(m => m.completed && !m.isBye);
    if (completedMatches.length === 0) return 0;
    
    const totalTwenties = completedMatches.reduce((sum, m) => 
      sum + (m.twenties1 || 0) + (m.twenties2 || 0), 0
    );
    const totalPlayerMatches = completedMatches.length * 4;
    return Math.round(totalTwenties / totalPlayerMatches);
  };

  // Delete all matches in the selected round
  const deleteRound = () => {
    if (!tournament || selectedRound === null) return;

    const updatedMatches = tournament.matches.filter(m => m.round !== selectedRound);
    const newCurrentRound = updatedMatches.length > 0 
      ? Math.max(...updatedMatches.map(m => m.round))
      : 0;

    setTournament({
      ...tournament,
      matches: updatedMatches,
      currentRound: newCurrentRound,
      status: newCurrentRound > 0 ? 'active' : 'setup',
      updatedAt: Date.now(),
    });

    // Immediately clear the form for fresh entry
    createEmptyForm();
    
    setSuccess(`Round ${selectedRound} deleted - form cleared for new entry`);
    setShowDeleteConfirm(false);
    
    setTimeout(() => setSuccess(null), 2000);
  };

  // Save the round
  const saveRound = () => {
    if (!tournament || selectedRound === null) return;
    setError(null);

    // Validate all matches have complete data
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      if (!match.team1Player1 || !match.team1Player2 || !match.team2Player1 || !match.team2Player2) {
        setError(`Match ${i + 1}: Please select all 4 players`);
        return;
      }
      if (!match.score1 || !match.score2) {
        setError(`Match ${i + 1}: Please enter both scores`);
        return;
      }
      const s1 = parseInt(match.score1);
      const s2 = parseInt(match.score2);
      if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
        setError(`Match ${i + 1}: Scores must be valid positive numbers`);
        return;
      }
      if (s1 + s2 !== 8) {
        setError(`Match ${i + 1}: Scores must add up to 8 (got ${s1} + ${s2} = ${s1 + s2})`);
        return;
      }
    }

    // Remove existing matches for this round
    const otherMatches = tournament.matches.filter(m => m.round !== selectedRound);

    // Create new match objects
    const newMatches: Match[] = matches.map(m => ({
      id: nanoid(8),
      round: selectedRound,
      team1: [m.team1Player1, m.team1Player2] as [string, string],
      team2: [m.team2Player1, m.team2Player2] as [string, string],
      score1: parseInt(m.score1),
      score2: parseInt(m.score2),
      twenties1: parseInt(m.twenties1) || 0,
      twenties2: parseInt(m.twenties2) || 0,
      tableId: null,
      completed: true,
      isBye: false,
    }));

    // Create bye matches for remaining players
    const byePlayers = getByePlayers();
    const avgTwenties = getAverageTwenties();
    
    byePlayers.forEach(player => {
      newMatches.push({
        id: nanoid(8),
        round: selectedRound,
        team1: [player.id] as [string],
        team2: null,
        score1: 4,
        score2: 4,
        twenties1: avgTwenties,
        twenties2: 0,
        tableId: null,
        completed: true,
        isBye: true,
      });
    });

    // Update tournament
    const allMatches = [...otherMatches, ...newMatches];
    const maxRound = Math.max(...allMatches.map(m => m.round));

    setTournament({
      ...tournament,
      matches: allMatches,
      currentRound: maxRound,
      status: 'active',
      updatedAt: Date.now(),
    });

    setSuccess(`Round ${selectedRound} saved successfully!`);
    setTimeout(() => setSuccess(null), 2000);
  };

  if (!tournament) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-bold">Round Management</h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-2xl"
          >
            ×
          </button>
        </div>

        {/* Round Selector */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Select Round to View/Edit</h3>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: tournament.totalRounds }, (_, i) => i + 1).map(round => {
              const hasData = roundHasData(round);
              const isSelected = selectedRound === round;
              const matchesInRound = getExistingMatches(round);
              const completedCount = matchesInRound.filter(m => m.completed).length;
              
              return (
                <button
                  key={round}
                  onClick={() => loadRound(round)}
                  className={`px-4 py-2 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-bg-primary)]'
                      : hasData
                      ? 'bg-green-500/20 border-green-500/30 text-green-400 hover:bg-green-500/30'
                      : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]'
                  }`}
                >
                  <div className="text-sm font-medium">Round {round}</div>
                  {hasData && (
                    <div className="text-xs opacity-75">
                      {completedCount} matches
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info Bar */}
        <div className="mb-4 p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-sm">
          <div className="flex flex-wrap gap-4">
            <span><strong>{activePlayers.length}</strong> active players</span>
            <span><strong>{matchCount}</strong> matches per round</span>
            {byeCount > 0 && (
              <span className="text-[var(--color-accent)]">
                <strong>{byeCount}</strong> player{byeCount > 1 ? 's' : ''} get bye
              </span>
            )}
          </div>
        </div>

        {/* Round Editor */}
        {selectedRound !== null ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Round {selectedRound}</h3>
              <div className="flex gap-2">
                {roundHasData(selectedRound) && (
                  <>
                    {showDeleteConfirm ? (
                      <>
                        <button
                          onClick={deleteRound}
                          className="btn btn-danger text-sm"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="btn btn-secondary text-sm"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="btn btn-danger text-sm"
                      >
                        Delete Round
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Match Entries */}
            <div className="space-y-4">
              {matches.map((match, idx) => (
                <div key={match.id} className="card p-4 bg-[var(--color-bg-tertiary)]">
                  <h4 className="font-medium mb-3">Match {idx + 1}</h4>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    {/* Team 1 */}
                    <div className="space-y-2">
                      <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Team 1</label>
                      <div className="flex gap-2">
                        <select
                          value={match.team1Player1}
                          onChange={(e) => updateMatch(match.id, 'team1Player1', e.target.value)}
                          className="input flex-1"
                        >
                          <option value="">Player 1...</option>
                          {[...getAvailablePlayers(match.id, 'team1Player1'),
                            ...(match.team1Player1 ? [activePlayers.find(p => p.id === match.team1Player1)!].filter(Boolean) : [])
                          ].map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <select
                          value={match.team1Player2}
                          onChange={(e) => updateMatch(match.id, 'team1Player2', e.target.value)}
                          className="input flex-1"
                        >
                          <option value="">Player 2...</option>
                          {[...getAvailablePlayers(match.id, 'team1Player2'),
                            ...(match.team1Player2 ? [activePlayers.find(p => p.id === match.team1Player2)!].filter(Boolean) : [])
                          ].map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Team 2 */}
                    <div className="space-y-2">
                      <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Team 2</label>
                      <div className="flex gap-2">
                        <select
                          value={match.team2Player1}
                          onChange={(e) => updateMatch(match.id, 'team2Player1', e.target.value)}
                          className="input flex-1"
                        >
                          <option value="">Player 1...</option>
                          {[...getAvailablePlayers(match.id, 'team2Player1'),
                            ...(match.team2Player1 ? [activePlayers.find(p => p.id === match.team2Player1)!].filter(Boolean) : [])
                          ].map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <select
                          value={match.team2Player2}
                          onChange={(e) => updateMatch(match.id, 'team2Player2', e.target.value)}
                          className="input flex-1"
                        >
                          <option value="">Player 2...</option>
                          {[...getAvailablePlayers(match.id, 'team2Player2'),
                            ...(match.team2Player2 ? [activePlayers.find(p => p.id === match.team2Player2)!].filter(Boolean) : [])
                          ].map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-[var(--color-text-muted)]">Team 1 Score</label>
                      <input
                        type="number"
                        min={0}
                        max={8}
                        value={match.score1}
                        onChange={(e) => updateMatch(match.id, 'score1', e.target.value)}
                        placeholder="0-8"
                        className="input w-full mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--color-text-muted)]">Team 2 Score</label>
                      <input
                        type="number"
                        min={0}
                        max={8}
                        value={match.score2}
                        onChange={(e) => updateMatch(match.id, 'score2', e.target.value)}
                        placeholder="0-8"
                        className="input w-full mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--color-text-muted)]">Team 1 20s</label>
                      <input
                        type="number"
                        min={0}
                        value={match.twenties1}
                        onChange={(e) => updateMatch(match.id, 'twenties1', e.target.value)}
                        placeholder="optional"
                        className="input w-full mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--color-text-muted)]">Team 2 20s</label>
                      <input
                        type="number"
                        min={0}
                        value={match.twenties2}
                        onChange={(e) => updateMatch(match.id, 'twenties2', e.target.value)}
                        placeholder="optional"
                        className="input w-full mt-1"
                      />
                    </div>
                  </div>

                  {/* Match Preview */}
                  {match.team1Player1 && match.team1Player2 && match.team2Player1 && match.team2Player2 && (
                    <div className="mt-3 text-sm text-[var(--color-text-muted)] bg-[var(--color-bg-primary)] p-2 rounded">
                      <span className="text-[var(--color-text-primary)]">
                        {getPlayerName(match.team1Player1)} + {getPlayerName(match.team1Player2)}
                      </span>
                      {' vs '}
                      <span className="text-[var(--color-text-primary)]">
                        {getPlayerName(match.team2Player1)} + {getPlayerName(match.team2Player2)}
                      </span>
                      {match.score1 && match.score2 && (
                        <span className="ml-2 text-[var(--color-accent)] font-medium">
                          ({match.score1} - {match.score2})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bye Players (auto-calculated) */}
            {byeCount > 0 && (
              <div className="mt-4 p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-dashed border-[var(--color-border)]">
                <h4 className="text-sm font-medium mb-2">Auto-Assigned Byes</h4>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  Players not assigned above will automatically receive a bye (4-4 tie, avg 20s)
                </p>
                <div className="flex flex-wrap gap-2">
                  {getByePlayers().length > 0 ? (
                    getByePlayers().map(p => (
                      <span key={p.id} className="px-2 py-1 bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded text-sm">
                        {p.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[var(--color-text-muted)] text-sm italic">
                      All players assigned to matches
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Error/Success Messages */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
                ✓ {success}
              </div>
            )}

            {/* Save Button */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={saveRound}
                className="btn btn-primary flex-1"
              >
                Save Round {selectedRound}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            <p>Select a round above to view or edit it</p>
          </div>
        )}

        {/* Close Button */}
        <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="btn btn-secondary w-full"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
