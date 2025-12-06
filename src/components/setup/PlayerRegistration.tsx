import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';

interface PlayerRegistrationProps {
  socket?: {
    addPlayer: (name: string) => void;
    removePlayer: (playerId: string) => void;
  };
}

export function PlayerRegistration({ socket }: PlayerRegistrationProps) {
  const { tournament, addPlayer: localAddPlayer, removePlayer: localRemovePlayer } = useTournamentStore();
  const [newPlayerName, setNewPlayerName] = useState('');
  
  const addPlayer = socket ? socket.addPlayer : localAddPlayer;
  const removePlayer = socket ? socket.removePlayer : localRemovePlayer;

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

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-display font-semibold">Players</h2>
        <span className="text-sm text-[var(--color-text-muted)]">
          {tournament.players.length} registered
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
              className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg group"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--color-text-muted)] font-mono w-6">
                  {index + 1}
                </span>
                <span className="text-[var(--color-text-primary)] font-medium">
                  {player.name}
                </span>
              </div>
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

