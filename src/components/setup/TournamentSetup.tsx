import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import { PlayerRegistration } from './PlayerRegistration';
import { TableSetup } from './TableSetup';

interface TournamentSetupProps {
  socket?: {
    addPlayer: (name: string) => void;
    removePlayer: (playerId: string) => void;
    updateSettings: (settings: any) => void;
    updateTournamentName: (name: string) => void;
    updateTotalRounds: (rounds: number) => void;
    startTournament: () => void;
    addTable: (name: string) => void;
    removeTable: (tableId: string) => void;
    updateTable: (tableId: string, name: string) => void;
  };
}

export function TournamentSetup({ socket }: TournamentSetupProps) {
  const { 
    tournament, 
    createTournament, 
    updateTournamentName: localUpdateName, 
    updateTotalRounds: localUpdateRounds,
    updateSettings: localUpdateSettings,
    startTournament: localStartTournament,
    getSavedTournamentSummaries,
    loadTournament,
    deleteSavedTournament,
    onlineMode,
    isHost,
  } = useTournamentStore();

  // Use socket methods if in online mode, otherwise use local store
  const updateTournamentName = socket ? socket.updateTournamentName : localUpdateName;
  const updateTotalRounds = socket ? socket.updateTotalRounds : localUpdateRounds;
  const updateSettings = socket ? socket.updateSettings : localUpdateSettings;
  const startTournament = socket ? socket.startTournament : localStartTournament;

  const [name, setName] = useState(tournament?.name || '');
  const [roundsInput, setRoundsInput] = useState((tournament?.totalRounds || 4).toString());
  const [showTableSetup, setShowTableSetup] = useState(tournament?.settings.tableAssignment || false);
  
  // Parse rounds as number, defaulting to 4
  const rounds = parseInt(roundsInput) || 4;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const savedTournaments = getSavedTournamentSummaries();

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleCreateTournament = () => {
    if (!tournament && name.trim()) {
      createTournament(name.trim(), rounds);
    }
  };

  const handleUpdateName = () => {
    if (tournament && name.trim()) {
      updateTournamentName(name.trim());
    }
  };

  const handleStartTournament = () => {
    if (tournament && tournament.players.length >= 4) {
      startTournament();
    }
  };

  const canStart = tournament && tournament.players.length >= 4;
  const playerCountValid = tournament ? tournament.players.length >= 4 : false;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Load Saved Tournament */}
      {savedTournaments.length > 0 && (
        <section className="card p-6">
          <h2 className="text-xl font-display font-semibold mb-4">Load Previous Tournament</h2>
          <div className="space-y-2">
            {savedTournaments.map((saved) => (
              <div
                key={saved.id}
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  saved.id === tournament?.id 
                    ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30' 
                    : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--color-text-primary)]">{saved.name}</span>
                    {saved.id === tournament?.id && (
                      <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                        Current
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                      saved.status === 'completed' 
                        ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                        : saved.status === 'active'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-[var(--color-text-muted)]/20 text-[var(--color-text-muted)]'
                    }`}>
                      {saved.status}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)] mt-0.5">
                    {saved.playerCount} players | R{saved.currentRound}/{saved.totalRounds}
                    {saved.winner && <span className="text-[var(--color-accent)]"> | Winner: {saved.winner}</span>}
                    <span className="ml-2">{formatDate(saved.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {saved.id !== tournament?.id && (
                    <button
                      onClick={() => loadTournament(saved.id)}
                      className="btn btn-primary text-sm px-4 py-1.5"
                    >
                      Load
                    </button>
                  )}
                  {showDeleteConfirm === saved.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => { deleteSavedTournament(saved.id); setShowDeleteConfirm(null); }}
                        className="btn btn-danger text-xs px-2 py-1"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="btn btn-secondary text-xs px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(saved.id)}
                      className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tournament Info */}
      <section className="card p-6">
        <h2 className="text-xl font-display font-semibold mb-6">
          {tournament ? 'Tournament Setup' : 'Create New Tournament'}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Tournament Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleUpdateName}
              placeholder="Enter tournament name"
              className="input"
            />
          </div>

          <div>
            <label className="label">Number of Rounds</label>
            <input
              type="number"
              min={1}
              max={20}
              value={roundsInput}
              onChange={(e) => {
                setRoundsInput(e.target.value);
              }}
              onBlur={() => {
                // Validate and clamp on blur
                const val = Math.max(1, Math.min(20, parseInt(roundsInput) || 4));
                setRoundsInput(val.toString());
                if (tournament) updateTotalRounds(val);
              }}
              className="input"
            />
          </div>
        </div>

        {!tournament && (
          <button
            onClick={handleCreateTournament}
            disabled={!name.trim()}
            className="btn btn-primary mt-6"
          >
            Create Tournament
          </button>
        )}
      </section>

      {tournament && (
        <>
          {/* Settings */}
          <section className="card p-6">
            <h2 className="text-xl font-display font-semibold mb-6">Settings</h2>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTableSetup}
                  onChange={(e) => {
                    setShowTableSetup(e.target.checked);
                    updateSettings({ tableAssignment: e.target.checked });
                  }}
                  className="w-5 h-5 rounded border-[var(--color-border)] bg-[var(--color-bg-tertiary)] 
                           text-[var(--color-accent)] focus:ring-[var(--color-accent)] focus:ring-offset-0"
                />
                <span className="text-[var(--color-text-primary)]">
                  Assign tables/boards to matches
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tournament.settings.playerScoreEntry}
                  onChange={(e) => updateSettings({ playerScoreEntry: e.target.checked })}
                  className="w-5 h-5 rounded border-[var(--color-border)] bg-[var(--color-bg-tertiary)] 
                           text-[var(--color-accent)] focus:ring-[var(--color-accent)] focus:ring-offset-0"
                />
                <span className="text-[var(--color-text-primary)]">
                  Allow players to submit scores from their devices
                </span>
              </label>
            </div>
          </section>

          {/* Table Setup */}
          {showTableSetup && <TableSetup socket={socket} />}

          {/* Player Registration */}
          <PlayerRegistration socket={socket} />

          {/* Start Tournament */}
          <section className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-display font-semibold">Ready to Start?</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {playerCountValid
                    ? `${tournament.players.length} players registered - you can start the tournament`
                    : `Need at least 4 players (currently ${tournament.players.length})`
                  }
                </p>
              </div>
              <button
                onClick={handleStartTournament}
                disabled={!canStart}
                className={`btn ${canStart ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'}`}
              >
                Start Tournament
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

