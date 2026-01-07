import { useState, useMemo, useRef } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import type { Player, Match, Tournament } from '../../types';
import { nanoid } from 'nanoid';
import type { Socket } from 'socket.io-client';

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
  socket?: Socket | null;
}

export function ManualRoundEntry({ onClose, socket }: ManualRoundEntryProps) {
  const { tournament, setTournament } = useTournamentStore();
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePlayers = useMemo(() =>
    tournament?.players.filter(p => p.active) || [],
    [tournament?.players]
  );

  const matchCount = Math.floor(activePlayers.length / 4);
  const byeCount = activePlayers.length % 4;

  const getExistingMatches = (round: number): Match[] => {
    return tournament?.matches.filter(m => m.round === round) || [];
  };

  const roundHasData = (round: number): boolean => {
    return getExistingMatches(round).length > 0;
  };

  const loadRound = (round: number) => {
    setSelectedRound(round);
    setError(null);
    setSuccess(null);
    setShowDeleteConfirm(false);

    const existingMatches = getExistingMatches(round);

    if (existingMatches.length > 0) {
      const regularMatches = existingMatches.filter(m => !m.isBye);
      const loadedMatches: MatchEntry[] = regularMatches.map(m => ({
        id: m.id,
        team1Player1: m.team1[0] || '',
        team1Player2: m.team1[1] || '',
        team2Player1: m.team2?.[0] || '',
        team2Player2: m.team2?.[1] || '',
        score1: m.score1?.toString() || '',
        score2: m.score2?.toString() || '',
        twenties1: m.twenties1 ? m.twenties1.toString() : '',
        twenties2: m.twenties2 ? m.twenties2.toString() : '',
      }));
      setMatches(loadedMatches);
    } else {
      createEmptyForm();
    }
  };

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

  const updateMatch = (id: string, updates: Partial<MatchEntry>) => {
    setMatches(matches.map(m => {
      if (m.id !== id) return m;
      
      const newMatch = { ...m, ...updates };
      
      // Auto-calculate complementary score
      if ('score1' in updates && updates.score1 !== '') {
        const num = parseInt(updates.score1!);
        if (!isNaN(num) && num >= 0 && num <= 8) {
          newMatch.score2 = String(8 - num);
        }
      } else if ('score2' in updates && updates.score2 !== '') {
        const num = parseInt(updates.score2!);
        if (!isNaN(num) && num >= 0 && num <= 8) {
          newMatch.score1 = String(8 - num);
        }
      }
      
      return newMatch;
    }));
  };

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

  const getByePlayers = (): Player[] => {
    const used = getUsedPlayerIds();
    return activePlayers.filter(p => !used.has(p.id));
  };

  const getPlayerName = (id: string): string => {
    return activePlayers.find(p => p.id === id)?.name || '';
  };

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

  const deleteRound = () => {
    if (!tournament || selectedRound === null) return;

    const updatedMatches = tournament.matches.filter(m => m.round !== selectedRound);
    const newCurrentRound = updatedMatches.length > 0
      ? Math.max(...updatedMatches.map(m => m.round))
      : 0;

    const updatedTournament = {
      ...tournament,
      matches: updatedMatches,
      currentRound: newCurrentRound,
      status: newCurrentRound > 0 ? 'active' as const : 'setup' as const,
      updatedAt: Date.now(),
    };

    if (socket?.connected) {
      socket.emit('manual_update_tournament', updatedTournament);
    }

    setTournament(updatedTournament);
    createEmptyForm();
    setSuccess(`Round ${selectedRound} deleted`);
    setShowDeleteConfirm(false);
    setTimeout(() => setSuccess(null), 2000);
  };

  const saveRound = () => {
    if (!tournament || selectedRound === null) return;
    setError(null);

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      if (!match.team1Player1 || !match.team1Player2 || !match.team2Player1 || !match.team2Player2) {
        setError(`Match ${i + 1}: Please select all 4 players`);
        return;
      }
      if (!match.score1 || !match.score2) {
        setError(`Match ${i + 1}: Please enter scores`);
        return;
      }
      const s1 = parseInt(match.score1);
      const s2 = parseInt(match.score2);
      if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 + s2 !== 8) {
        setError(`Match ${i + 1}: Scores must add up to 8`);
        return;
      }
    }

    const otherMatches = tournament.matches.filter(m => m.round !== selectedRound);

    const newMatches: Match[] = matches.map(m => ({
      id: nanoid(8),
      round: selectedRound,
      team1: [m.team1Player1, m.team1Player2] as [string, string],
      team2: [m.team2Player1, m.team2Player2] as [string, string],
      score1: parseInt(m.score1),
      score2: parseInt(m.score2),
      twenties1: m.twenties1 ? parseInt(m.twenties1) : 0,
      twenties2: m.twenties2 ? parseInt(m.twenties2) : 0,
      tableId: null,
      completed: true,
      isBye: false,
    }));

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

    const allMatches = [...otherMatches, ...newMatches];
    const maxRound = Math.max(...allMatches.map(m => m.round));

    const updatedTournament = {
      ...tournament,
      matches: allMatches,
      currentRound: maxRound,
      status: 'active' as const,
      updatedAt: Date.now(),
    };

    if (socket?.connected) {
      socket.emit('manual_update_tournament', updatedTournament);
    }

    setTournament(updatedTournament);
    setSuccess(`Round ${selectedRound} saved!`);
    setTimeout(() => setSuccess(null), 2000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        if (!json.players || !json.matches) {
          throw new Error('Invalid tournament JSON');
        }

        const importedTournament: Tournament = {
          id: tournament?.id || json.id || nanoid(8),
          name: json.name || tournament?.name || 'Imported Tournament',
          players: json.players,
          matches: json.matches,
          tables: json.tables || tournament?.tables || [],
          currentRound: json.currentRound || Math.max(...json.matches.map((m: Match) => m.round), 0),
          totalRounds: json.totalRounds || tournament?.totalRounds || 6,
          status: json.status || 'active',
          settings: json.settings || tournament?.settings || { allowTies: true, pointsForWin: 2, pointsForTie: 1, pointsForLoss: 0 },
          shareCode: tournament?.shareCode || json.shareCode || '',
          createdAt: json.createdAt || tournament?.createdAt || Date.now(),
          updatedAt: Date.now(),
          pairingLogs: json.pairingLogs || [],
          finalsConfig: json.finalsConfig || { enabled: false, poolConfigs: [], configured: false },
          bracketMatches: json.bracketMatches || [],
        };

        if (socket?.connected) {
          socket.emit('manual_update_tournament', importedTournament);
        }

        setTournament(importedTournament);
        setSuccess('Tournament imported!');
        if (selectedRound !== null) {
          setTimeout(() => loadRound(selectedRound), 100);
        }
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(`Import failed: ${err instanceof Error ? err.message : 'Invalid JSON'}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = () => {
    if (!tournament) return;
    const dataStr = JSON.stringify(tournament, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tournament-${tournament.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveMatchEdit = (match: MatchEntry) => {
    updateMatch(match.id, match);
    setEditingMatch(null);
  };

  if (!tournament) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-bold">Round Management</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-2xl">×</button>
        </div>

        {/* Import/Export */}
        <div className="mb-6 p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Backup & Restore</h3>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleExport} className="btn btn-secondary text-sm flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export JSON
            </button>
            <label className="btn btn-secondary text-sm flex items-center gap-2 cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Import JSON
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} className="hidden" />
            </label>
          </div>
        </div>

        {/* Round Selector */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Select Round</h3>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: tournament.totalRounds }, (_, i) => i + 1).map(round => {
              const hasData = roundHasData(round);
              const isSelected = selectedRound === round;
              const matchesInRound = getExistingMatches(round);
              const regularMatchCount = matchesInRound.filter(m => !m.isBye && m.completed).length;
              const byeMatchCount = matchesInRound.filter(m => m.isBye && m.completed).length;

              return (
                <button
                  key={round}
                  onClick={() => loadRound(round)}
                  className={`px-4 py-2 rounded-lg border transition-all ${isSelected
                    ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-bg-primary)]'
                    : hasData
                      ? 'bg-green-500/20 border-green-500/30 text-green-400 hover:bg-green-500/30'
                      : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]'
                  }`}
                >
                  <div className="text-sm font-medium">Round {round}</div>
                  {hasData && (
                    <div className="text-xs opacity-75">
                      {regularMatchCount} match{regularMatchCount !== 1 ? 'es' : ''}
                      {byeMatchCount > 0 && ` + ${byeMatchCount} bye${byeMatchCount !== 1 ? 's' : ''}`}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Round Info */}
        <div className="mb-4 p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-sm flex flex-wrap gap-4">
          <span><strong>{activePlayers.length}</strong> players</span>
          <span><strong>{matchCount}</strong> matches/round</span>
          {byeCount > 0 && (
            <span className="text-[var(--color-accent)]"><strong>{byeCount}</strong> bye{byeCount > 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Match Cards */}
        {selectedRound !== null ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Round {selectedRound}</h3>
              {roundHasData(selectedRound) && (
                <div className="flex gap-2">
                  {showDeleteConfirm ? (
                    <>
                      <button onClick={deleteRound} className="btn btn-danger text-sm">Confirm Delete</button>
                      <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary text-sm">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setShowDeleteConfirm(true)} className="btn btn-danger text-sm">Delete Round</button>
                  )}
                </div>
              )}
            </div>

            {/* Match Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {matches.map((match, idx) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  index={idx}
                  getPlayerName={getPlayerName}
                  onEdit={() => setEditingMatch(match)}
                />
              ))}
            </div>

            {/* Bye Players */}
            {byeCount > 0 && (
              <div className="mt-4 p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-dashed border-[var(--color-border)]">
                <h4 className="text-sm font-medium mb-2">Byes (auto-assigned)</h4>
                <div className="flex flex-wrap gap-2">
                  {getByePlayers().length > 0 ? (
                    getByePlayers().map(p => (
                      <span key={p.id} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-sm">{p.name}</span>
                    ))
                  ) : (
                    <span className="text-[var(--color-text-muted)] text-sm italic">All players assigned</span>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
            )}
            {success && (
              <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">✓ {success}</div>
            )}

            {/* Save Button */}
            <div className="mt-6">
              <button onClick={saveRound} className="btn btn-primary w-full">
                Save Round {selectedRound}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            <p>Select a round above to view or edit</p>
          </div>
        )}

        {/* Close Button */}
        <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
          <button onClick={onClose} className="btn btn-secondary w-full">Close</button>
        </div>
      </div>

      {/* Edit Modal */}
      {editingMatch && (
        <MatchEditModal
          match={editingMatch}
          allMatches={matches}
          activePlayers={activePlayers}
          onSave={handleSaveMatchEdit}
          onClose={() => setEditingMatch(null)}
        />
      )}
    </div>
  );
}

// Compact Match Card
interface MatchCardProps {
  match: MatchEntry;
  index: number;
  getPlayerName: (id: string) => string;
  onEdit: () => void;
}

function MatchCard({ match, index, getPlayerName, onEdit }: MatchCardProps) {
  const team1Name1 = getPlayerName(match.team1Player1);
  const team1Name2 = getPlayerName(match.team1Player2);
  const team2Name1 = getPlayerName(match.team2Player1);
  const team2Name2 = getPlayerName(match.team2Player2);
  
  const hasAllPlayers = team1Name1 && team1Name2 && team2Name1 && team2Name2;
  const hasScores = match.score1 && match.score2;
  const isComplete = hasAllPlayers && hasScores;
  
  const s1 = parseInt(match.score1) || 0;
  const s2 = parseInt(match.score2) || 0;
  const team1Wins = s1 > s2;
  const team2Wins = s2 > s1;

  return (
    <div
      onClick={onEdit}
      className={`rounded-lg border overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-[var(--color-accent)]/50 ${
        isComplete ? 'border-[var(--color-success)]' : 'border-[var(--color-accent)]'
      }`}
    >
      {/* Header */}
      <div className={`py-1.5 px-3 flex items-center justify-between ${
        isComplete ? 'bg-[var(--color-success)]' : 'bg-[var(--color-accent)]'
      }`}>
        <span className="text-sm font-bold uppercase tracking-wide text-[var(--color-bg-primary)]">
          Match {index + 1}
        </span>
        <span className="text-xs text-[var(--color-bg-primary)]/80">
          {isComplete ? '✓ Edit' : 'Edit'}
        </span>
      </div>

      {/* Content */}
      <div className="p-3 bg-[var(--color-bg-secondary)] space-y-1">
        {hasAllPlayers ? (
          <>
            {/* Team 1 */}
            <div className={`flex items-center justify-between rounded px-2 py-1.5 ${
              team1Wins ? 'bg-[var(--color-success)]/10' : 'bg-[var(--color-bg-tertiary)]'
            }`}>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${team1Wins ? 'text-[var(--color-success)]' : ''}`}>
                  {team1Name1}
                </div>
                <div className={`text-sm font-semibold truncate ${team1Wins ? 'text-[var(--color-success)]' : ''}`}>
                  {team1Name2}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <span className={`text-xl font-mono font-bold ${team1Wins ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}>
                  {match.score1 || '-'}
                </span>
                {match.twenties1 && parseInt(match.twenties1) > 0 && (
                  <span className="text-xs text-[var(--color-accent)]">({match.twenties1})</span>
                )}
              </div>
            </div>

            {/* VS */}
            <div className="text-center text-xs text-[var(--color-text-muted)]">vs</div>

            {/* Team 2 */}
            <div className={`flex items-center justify-between rounded px-2 py-1.5 ${
              team2Wins ? 'bg-[var(--color-success)]/10' : 'bg-[var(--color-bg-tertiary)]'
            }`}>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${team2Wins ? 'text-[var(--color-success)]' : ''}`}>
                  {team2Name1}
                </div>
                <div className={`text-sm font-semibold truncate ${team2Wins ? 'text-[var(--color-success)]' : ''}`}>
                  {team2Name2}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <span className={`text-xl font-mono font-bold ${team2Wins ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}>
                  {match.score2 || '-'}
                </span>
                {match.twenties2 && parseInt(match.twenties2) > 0 && (
                  <span className="text-xs text-[var(--color-accent)]">({match.twenties2})</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="py-4 text-center text-[var(--color-text-muted)] text-sm">
            Click to configure match
          </div>
        )}
      </div>
    </div>
  );
}

// Match Edit Modal
interface MatchEditModalProps {
  match: MatchEntry;
  allMatches: MatchEntry[];
  activePlayers: Player[];
  onSave: (match: MatchEntry) => void;
  onClose: () => void;
}

function MatchEditModal({ match, allMatches, activePlayers, onSave, onClose }: MatchEditModalProps) {
  const [editedMatch, setEditedMatch] = useState<MatchEntry>({ ...match });

  const updateField = (field: keyof MatchEntry, value: string) => {
    const updates: Partial<MatchEntry> = { [field]: value };
    
    // Auto-calculate complementary score
    if (field === 'score1' && value !== '') {
      const num = parseInt(value);
      if (!isNaN(num) && num >= 0 && num <= 8) {
        updates.score2 = String(8 - num);
      }
    } else if (field === 'score2' && value !== '') {
      const num = parseInt(value);
      if (!isNaN(num) && num >= 0 && num <= 8) {
        updates.score1 = String(8 - num);
      }
    }
    
    setEditedMatch(prev => ({ ...prev, ...updates }));
  };

  const getPlayerName = (id: string): string => {
    return activePlayers.find(p => p.id === id)?.name || '';
  };

  // Get players available for a specific field
  // Only bye players (those not in other matches) + the current player for this field
  const getPlayersForField = (field: keyof MatchEntry): Player[] => {
    // Get all players used in OTHER matches (not the one being edited)
    const usedInOtherMatches = new Set<string>();
    allMatches.forEach(m => {
      if (m.id === match.id) return; // Skip the match being edited
      if (m.team1Player1) usedInOtherMatches.add(m.team1Player1);
      if (m.team1Player2) usedInOtherMatches.add(m.team1Player2);
      if (m.team2Player1) usedInOtherMatches.add(m.team2Player1);
      if (m.team2Player2) usedInOtherMatches.add(m.team2Player2);
    });
    
    // Get players used in THIS match (other fields)
    const usedInThisMatch = new Set<string>();
    if (field !== 'team1Player1' && editedMatch.team1Player1) usedInThisMatch.add(editedMatch.team1Player1);
    if (field !== 'team1Player2' && editedMatch.team1Player2) usedInThisMatch.add(editedMatch.team1Player2);
    if (field !== 'team2Player1' && editedMatch.team2Player1) usedInThisMatch.add(editedMatch.team2Player1);
    if (field !== 'team2Player2' && editedMatch.team2Player2) usedInThisMatch.add(editedMatch.team2Player2);
    
    // Available = not used elsewhere AND not used in other fields of this match
    return activePlayers.filter(p => 
      !usedInOtherMatches.has(p.id) && !usedInThisMatch.has(p.id)
    );
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={handleBackdropClick}>
      <div className="bg-[var(--color-bg-secondary)] rounded-xl w-full max-w-md shadow-2xl border border-[var(--color-border)]">
        {/* Header */}
        <div className="bg-[var(--color-accent)] px-4 py-3 rounded-t-xl flex items-center justify-between">
          <span className="font-bold text-[var(--color-bg-primary)]">Edit Match</span>
          <button onClick={onClose} className="text-[var(--color-bg-primary)]/80 hover:text-[var(--color-bg-primary)] text-xl">×</button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Team 1 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-accent)]">Team 1</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={editedMatch.team1Player1}
                onChange={(e) => updateField('team1Player1', e.target.value)}
                className="input text-sm"
              >
                <option value="">Select player...</option>
                {getPlayersForField('team1Player1').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={editedMatch.team1Player2}
                onChange={(e) => updateField('team1Player2', e.target.value)}
                className="input text-sm"
              >
                <option value="">Select player...</option>
                {getPlayersForField('team1Player2').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {/* Team 1 Preview */}
            <div className="text-xs text-[var(--color-text-muted)]">
              {getPlayerName(editedMatch.team1Player1) && getPlayerName(editedMatch.team1Player2) 
                ? `${getPlayerName(editedMatch.team1Player1)} & ${getPlayerName(editedMatch.team1Player2)}`
                : 'Select both players'}
            </div>
          </div>

          {/* VS Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--color-border)]" />
            <span className="text-sm font-bold text-[var(--color-text-muted)]">VS</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          {/* Team 2 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-accent)]">Team 2</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={editedMatch.team2Player1}
                onChange={(e) => updateField('team2Player1', e.target.value)}
                className="input text-sm"
              >
                <option value="">Select player...</option>
                {getPlayersForField('team2Player1').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={editedMatch.team2Player2}
                onChange={(e) => updateField('team2Player2', e.target.value)}
                className="input text-sm"
              >
                <option value="">Select player...</option>
                {getPlayersForField('team2Player2').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {/* Team 2 Preview */}
            <div className="text-xs text-[var(--color-text-muted)]">
              {getPlayerName(editedMatch.team2Player1) && getPlayerName(editedMatch.team2Player2)
                ? `${getPlayerName(editedMatch.team2Player1)} & ${getPlayerName(editedMatch.team2Player2)}`
                : 'Select both players'}
            </div>
          </div>

          {/* Scores */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Team 1 Score</label>
              <input
                type="number"
                min={0}
                max={8}
                value={editedMatch.score1}
                onChange={(e) => updateField('score1', e.target.value)}
                className="input w-full mt-1 text-center text-xl font-mono font-bold"
                placeholder="0-8"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Team 2 Score</label>
              <input
                type="number"
                min={0}
                max={8}
                value={editedMatch.score2}
                onChange={(e) => updateField('score2', e.target.value)}
                className="input w-full mt-1 text-center text-xl font-mono font-bold bg-[var(--color-bg-tertiary)]"
                placeholder="auto"
              />
            </div>
          </div>

          {/* 20s */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[var(--color-text-muted)]">Team 1 20s (optional)</label>
              <input
                type="number"
                min={0}
                value={editedMatch.twenties1}
                onChange={(e) => updateField('twenties1', e.target.value)}
                className="input w-full mt-1 text-center"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--color-text-muted)]">Team 2 20s (optional)</label>
              <input
                type="number"
                min={0}
                value={editedMatch.twenties2}
                onChange={(e) => updateField('twenties2', e.target.value)}
                className="input w-full mt-1 text-center"
                placeholder="0"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 btn btn-secondary">Cancel</button>
            <button onClick={() => onSave(editedMatch)} className="flex-1 btn btn-primary font-semibold">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
