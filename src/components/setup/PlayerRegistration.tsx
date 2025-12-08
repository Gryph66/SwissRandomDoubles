import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';

interface PlayerRegistrationProps {
  socket?: {
    addPlayer: (name: string) => void;
    removePlayer: (playerId: string) => void;
    updatePlayer: (playerId: string, updates: any) => void;
  };
}

export function PlayerRegistration({ socket }: PlayerRegistrationProps) {
  const { tournament, addPlayer: localAddPlayer, removePlayer: localRemovePlayer, updatePlayer: localUpdatePlayer } = useTournamentStore();
  const [newPlayerName, setNewPlayerName] = useState('');
  
  const addPlayer = socket ? socket.addPlayer : localAddPlayer;
  const removePlayer = socket ? socket.removePlayer : localRemovePlayer;
  const updatePlayer = socket ? socket.updatePlayer : localUpdatePlayer;

  if (!tournament) return null;

  const handleAddPlayer = () => {
    if (newPlayerName.trim()) {
      addPlayer(newPlayerName.trim());
      setNewPlayerName('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddPlayer();
    }
  };

  const canRemove = tournament.status === 'setup';
  const isActive = tournament.status === 'active';
  const activePlayers = tournament.players.filter(p => p.active);
  const inactivePlayers = tournament.players.filter(p => !p.active);

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-display font-semibold">Players</h2>
        <span className="text-sm text-[var(--color-text-muted)]">
          {activePlayers.length} active{inactivePlayers.length > 0 && ` (${inactivePlayers.length} inactive)`}
        </span>
      </div>

      {/* Add Player Form */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={newPlayerName}
          onChange={(e) => setNewPlayerName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter player name"
          className="input flex-1"
        />
        <button
          onClick={handleAddPlayer}
          disabled={!newPlayerName.trim()}
          className="btn btn-primary"
        >
          Add Player
        </button>
      </div>

      {/* Player List */}
      {tournament.players.length === 0 ? (
        <div className="text-center py-8 text-[var(--color-text-muted)]">
          No players registered yet. Add players above to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tournament.players.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg group transition-all ${
                player.active 
                  ? 'bg-[var(--color-bg-tertiary)]' 
                  : 'bg-[var(--color-bg-tertiary)]/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--color-text-muted)] font-mono w-6">
                  {index + 1}
                </span>
                <span className={`font-medium ${
                  player.active 
                    ? 'text-[var(--color-text-primary)]' 
                    : 'text-[var(--color-text-muted)] line-through'
                }`}>
                  {player.name}
                </span>
                {!player.active && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                    inactive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Activate/Deactivate toggle - shown during active tournament */}
                {isActive && (
                  <button
                    onClick={() => updatePlayer(player.id, { active: !player.active })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      player.active ? 'bg-[var(--color-success)]' : 'bg-[var(--color-bg-primary)]'
                    }`}
                    title={player.active ? 'Deactivate player' : 'Reactivate player'}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        player.active ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </button>
                )}
                {/* Remove button - only during setup */}
                {canRemove && (
                  <button
                    onClick={() => removePlayer(player.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-muted)] 
                             hover:text-red-400 transition-all duration-200"
                    title="Remove player"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Add Multiple */}
      <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
        <QuickAddPlayers addPlayer={addPlayer} />
      </div>
    </section>
  );
}

function QuickAddPlayers({ addPlayer }: { addPlayer: (name: string) => void }) {
  const [bulkText, setBulkText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleBulkAdd = () => {
    const names = bulkText
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    names.forEach((name) => addPlayer(name));
    setBulkText('');
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
      >
        Add multiple players at once...
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <label className="label">Add Multiple Players (one per line)</label>
      <textarea
        value={bulkText}
        onChange={(e) => setBulkText(e.target.value)}
        placeholder="Alice&#10;Bob&#10;Carol&#10;Dan"
        rows={6}
        className="input resize-none"
      />
      <div className="flex gap-3">
        <button onClick={handleBulkAdd} className="btn btn-primary">
          Add All
        </button>
        <button onClick={() => setIsExpanded(false)} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}

