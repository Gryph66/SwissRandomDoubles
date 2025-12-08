import { useState, useRef } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import { PlayerRegistration } from './PlayerRegistration';
import { TableSetup } from './TableSetup';
import type { Tournament, Match } from '../../types';
import { nanoid } from 'nanoid';
import type { Socket } from 'socket.io-client';

interface TournamentSetupProps {
  socket?: {
    socket: Socket | null;
    addPlayer: (name: string) => void;
    removePlayer: (playerId: string) => void;
    updatePlayer: (playerId: string, updates: any) => void;
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
    setTournament,
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
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [addRoundsCount, setAddRoundsCount] = useState(1);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle JSON file import
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // Validate the JSON structure
        if (!json.players || !Array.isArray(json.players)) {
          throw new Error('Invalid tournament JSON - missing players array');
        }

        // Create a tournament object from the imported JSON
        const importedTournament: Tournament = {
          id: json.id || nanoid(8),
          name: json.name || 'Imported Tournament',
          players: json.players,
          matches: json.matches || [],
          tables: json.tables || [],
          currentRound: json.currentRound || (json.matches?.length > 0 ? Math.max(...json.matches.map((m: Match) => m.round)) : 0),
          totalRounds: json.totalRounds || 6,
          status: json.status || (json.matches?.length > 0 ? 'active' : 'setup'),
          settings: json.settings || { allowTies: true, pointsForWin: 2, pointsForTie: 1, pointsForLoss: 0 },
          shareCode: json.shareCode || '',
          createdAt: json.createdAt || Date.now(),
          updatedAt: Date.now(),
          pairingLogs: json.pairingLogs || [],
        };

        // Emit to server if in online mode
        if (socket?.socket?.connected) {
          socket.socket.emit('manual_update_tournament', importedTournament);
        }
        
        setTournament(importedTournament);
        setName(importedTournament.name);
        setRoundsInput(importedTournament.totalRounds.toString());
        setImportMessage({ type: 'success', text: `Imported "${importedTournament.name}" with ${importedTournament.players.length} players and ${importedTournament.matches.length} matches` });
        
        setTimeout(() => setImportMessage(null), 5000);
      } catch (err) {
        setImportMessage({ type: 'error', text: `Failed to import: ${err instanceof Error ? err.message : 'Invalid JSON'}` });
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle adding more rounds
  const handleAddRounds = () => {
    if (!tournament) return;
    
    const newTotalRounds = tournament.totalRounds + addRoundsCount;
    
    // If tournament is completed, reactivate it
    const updatedTournament = {
      ...tournament,
      totalRounds: newTotalRounds,
      status: tournament.status === 'completed' ? 'active' as const : tournament.status,
      updatedAt: Date.now(),
    };

    // Emit to server if in online mode
    if (socket?.socket?.connected) {
      socket.socket.emit('manual_update_tournament', updatedTournament);
    }
    
    setTournament(updatedTournament);
    setRoundsInput(newTotalRounds.toString());
    setImportMessage({ 
      type: 'success', 
      text: `Added ${addRoundsCount} round${addRoundsCount > 1 ? 's' : ''}. Tournament now has ${newTotalRounds} rounds.${tournament.status === 'completed' ? ' Tournament reactivated!' : ''}`
    });
    
    setTimeout(() => setImportMessage(null), 3000);
  };

  // Handle completing tournament early
  const handleCompleteEarly = () => {
    if (!tournament) return;
    
    // Set total rounds to current round and mark as completed
    const updatedTournament = {
      ...tournament,
      totalRounds: tournament.currentRound,
      status: 'completed' as const,
      updatedAt: Date.now(),
    };

    // Emit to server if in online mode
    if (socket?.socket?.connected) {
      socket.socket.emit('manual_update_tournament', updatedTournament);
    }
    
    setTournament(updatedTournament);
    setRoundsInput(tournament.currentRound.toString());
    setShowCompleteConfirm(false);
    setImportMessage({ 
      type: 'success', 
      text: `Tournament completed after ${tournament.currentRound} rounds.`
    });
    
    setTimeout(() => setImportMessage(null), 3000);
  };

  const canStart = tournament && tournament.players.length >= 4 && tournament.status === 'setup';
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

      {/* Import JSON - shown when no tournament or always as an option */}
      <section className="card p-6">
        <h2 className="text-xl font-display font-semibold mb-4">Import Tournament</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Load a tournament from a previously exported JSON backup file.
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="btn btn-secondary flex items-center gap-2 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Import JSON File
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>
          {importMessage && (
            <span className={`text-sm ${importMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {importMessage.text}
            </span>
          )}
        </div>
      </section>

      {tournament && (
        <>
          {/* Add More Rounds - shown when tournament is active or completed */}
          {(tournament.status === 'active' || tournament.status === 'completed') && (
            <section className="card p-6">
              <h2 className="text-xl font-display font-semibold mb-4">Add More Rounds</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Extend the tournament by adding more rounds.
                {tournament.status === 'completed' && (
                  <span className="text-[var(--color-accent)]"> This will reactivate the completed tournament.</span>
                )}
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--color-text-muted)]">Current:</span>
                  <span className="font-medium">{tournament.totalRounds} rounds</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--color-text-muted)]">Add:</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={addRoundsCount}
                    onChange={(e) => setAddRoundsCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className="input w-16 text-center"
                  />
                  <span className="text-sm text-[var(--color-text-muted)]">round{addRoundsCount > 1 ? 's' : ''}</span>
                </div>
                <button
                  onClick={handleAddRounds}
                  className="btn btn-primary"
                >
                  Add Rounds
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-3">
                New total: {tournament.totalRounds + addRoundsCount} rounds
              </p>
            </section>
          )}

          {/* Complete Tournament Early - shown when active and has remaining rounds */}
          {tournament.status === 'active' && tournament.currentRound < tournament.totalRounds && tournament.currentRound > 0 && (
            <section className="card p-6 border-[var(--color-accent)]/30">
              <h2 className="text-xl font-display font-semibold mb-4">End Tournament Early</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Complete the tournament now after {tournament.currentRound} round{tournament.currentRound > 1 ? 's' : ''} 
                instead of playing all {tournament.totalRounds} rounds.
              </p>
              <div className="flex items-center gap-4">
                {showCompleteConfirm ? (
                  <>
                    <span className="text-sm text-[var(--color-text-muted)]">
                      Are you sure? This will end the tournament at Round {tournament.currentRound}.
                    </span>
                    <button
                      onClick={handleCompleteEarly}
                      className="btn bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:bg-[var(--color-accent)]/80"
                    >
                      Yes, Complete Now
                    </button>
                    <button
                      onClick={() => setShowCompleteConfirm(false)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowCompleteConfirm(true)}
                    className="btn btn-secondary"
                  >
                    Complete Tournament After Round {tournament.currentRound}
                  </button>
                )}
              </div>
            </section>
          )}

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

          {/* Player Registration */}
          <PlayerRegistration socket={socket} />

          {/* Table Setup - below players so we know how many tables needed */}
          {showTableSetup && <TableSetup socket={socket} />}

          {/* Start Tournament - only shown in setup mode */}
          {tournament.status === 'setup' && (
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
          )}

          {/* Tournament Status Info - shown when active or completed */}
          {(tournament.status === 'active' || tournament.status === 'completed') && (
            <section className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-display font-semibold">
                    Tournament {tournament.status === 'completed' ? 'Completed' : 'In Progress'}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    Round {tournament.currentRound} of {tournament.totalRounds} • {tournament.players.filter(p => p.active).length} active players
                  </p>
                </div>
                <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  tournament.status === 'completed' 
                    ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {tournament.status === 'completed' ? 'Completed' : 'Active'}
                </span>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

