import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import { QRCodeSVG } from 'qrcode.react';
import { Scorecard } from './Scorecard';
import { ManualRoundEntry } from './ManualRoundEntry';
import { downloadLog, generateLogText } from '../../utils/pairingLog';

interface AdminPanelProps {
  socket?: {
    socket: ReturnType<typeof import('socket.io-client').io> | null;
    addPlayer: (name: string) => void;
    updateSettings: (settings: any) => void;
    resetTournament: () => void;
  };
  showQRCode?: boolean;
  onToggleQRCode?: () => void;
}

export function AdminPanel({ socket, showQRCode, onToggleQRCode }: AdminPanelProps) {
  const {
    tournament,
    resetTournament: localResetTournament,
    addPlayer: localAddPlayer,
    updateSettings: localUpdateSettings,
    saveTournament,
    loadTournament,
    deleteSavedTournament,
    getSavedTournamentSummaries
  } = useTournamentStore();

  const addPlayer = socket ? socket.addPlayer : localAddPlayer;
  const updateSettings = socket ? socket.updateSettings : localUpdateSettings;
  const resetTournament = socket ? socket.resetTournament : localResetTournament;

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showLoadConfirm, setShowLoadConfirm] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showPairingLog, setShowPairingLog] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const savedTournaments = getSavedTournamentSummaries();

  const handleSave = () => {
    saveTournament();
    setSaveMessage('Tournament saved!');
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const handleLoad = (id: string) => {
    loadTournament(id);
    setShowLoadConfirm(null);
  };

  const handleDelete = (id: string) => {
    deleteSavedTournament(id);
    setShowDeleteConfirm(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (!tournament) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-text-muted)]">No tournament in progress</p>
      </div>
    );
  }

  const handleAddPlayer = () => {
    if (newPlayerName.trim()) {
      addPlayer(newPlayerName.trim());
      setNewPlayerName('');
    }
  };

  const handleReset = () => {
    resetTournament();
    setShowResetConfirm(false);
  };

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?code=${tournament.shareCode}`
    : '';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h2 className="text-2xl font-display font-bold">Admin Panel</h2>

      {/* Tournament Info */}
      <section className="card p-6">
        <h3 className="text-lg font-display font-semibold mb-4">Tournament Info</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[var(--color-text-muted)]">Name:</span>
            <span className="ml-2 text-[var(--color-text-primary)]">{tournament.name}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Status:</span>
            <span className={`ml-2 capitalize ${tournament.status === 'active' ? 'text-[var(--color-success)]' :
              tournament.status === 'completed' ? 'text-[var(--color-accent)]' :
                'text-[var(--color-text-primary)]'
              }`}>
              {tournament.status}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Round:</span>
            <span className="ml-2 text-[var(--color-text-primary)]">
              {tournament.currentRound} of {tournament.totalRounds}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Players:</span>
            <span className="ml-2 text-[var(--color-text-primary)]">
              {tournament.players.length}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Share Code:</span>
            <code className="ml-2 px-2 py-0.5 bg-[var(--color-bg-tertiary)] rounded text-[var(--color-accent)] font-mono">
              {tournament.shareCode}
            </code>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Matches:</span>
            <span className="ml-2 text-[var(--color-text-primary)]">
              {tournament.matches.filter(m => !m.isBye).length} ({tournament.matches.filter(m => m.completed && !m.isBye).length} complete)
            </span>
          </div>
        </div>
      </section>

      {/* Pool Settings */}
      <section className="card p-6">
        <h3 className="text-lg font-display font-semibold mb-4">After Tournament Pool Settings</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Configure the pool size for post-tournament groupings. Players will be divided into pools (A, B, C, etc.)
          based on their final standings. This is used on the Standings and Analysis pages.
        </p>
        <div className="flex items-center gap-4">
          <label className="text-sm text-[var(--color-text-muted)]">Pool Size:</label>
          <input
            type="number"
            min="2"
            max="32"
            value={tournament.settings.poolSize || 8}
            onChange={(e) => updateSettings({ poolSize: Math.max(2, Math.min(32, parseInt(e.target.value) || 8)) })}
            className="input w-24 text-center"
          />
          <span className="text-sm text-[var(--color-text-muted)]">
            ({Math.ceil(tournament.players.length / (tournament.settings.poolSize || 8))} pools for {tournament.players.length} players)
          </span>
        </div>
      </section>

      {/* Display Settings */}
      <section className="card p-6">
        <h3 className="text-lg font-display font-semibold mb-4">Display Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Floating QR Code</span>
              <p className="text-xs text-[var(--color-text-muted)]">
                Show QR code in the bottom corner for players to join
              </p>
            </div>
            <button
              onClick={onToggleQRCode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showQRCode ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-tertiary)]'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showQRCode ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Share Tournament */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-semibold">Share Tournament</h3>
          <button
            onClick={() => setShowQR(!showQR)}
            className="btn btn-secondary text-sm"
          >
            {showQR ? 'Hide QR Code' : 'Show QR Code'}
          </button>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Players can view the tournament on their devices by visiting this URL or scanning the QR code.
        </p>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="input flex-1 font-mono text-sm"
          />
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="btn btn-secondary"
          >
            Copy
          </button>
        </div>

        {showQR && (
          <div className="mt-6 flex justify-center p-6 bg-white rounded-lg">
            <QRCodeSVG value={shareUrl} size={200} />
          </div>
        )}
      </section>

      {/* Add Player Mid-Tournament */}
      {tournament.status === 'active' && (
        <section className="card p-6">
          <h3 className="text-lg font-display font-semibold mb-4">Add Player</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Add a late arrival to the tournament. They will be included in the next round.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Player name"
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
        </section>
      )}

      {/* Save & Export Data */}
      <section className="card p-6">
        <h3 className="text-lg font-display font-semibold mb-4">Save & Export</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            className="btn btn-primary"
          >
            {saveMessage || 'Save Tournament'}
          </button>
          <button
            onClick={() => {
              const data = JSON.stringify(tournament, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${tournament.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="btn btn-secondary"
          >
            Export JSON
          </button>
          <button
            onClick={() => {
              const standings = useTournamentStore.getState().getStandings();
              const csv = [
                ['Rank', 'Name', 'Wins', 'Losses', 'Ties', 'Points For', 'Points Against', 'Diff', '20s'].join(','),
                ...standings.map((s) => [
                  s.rank,
                  `"${s.player.name}"`,
                  s.player.wins,
                  s.player.losses,
                  s.player.ties,
                  s.player.pointsFor,
                  s.player.pointsAgainst,
                  s.player.pointsFor - s.player.pointsAgainst,
                  s.player.twenties,
                ].join(','))
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${tournament.name.replace(/\s+/g, '-').toLowerCase()}-standings.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="btn btn-secondary"
          >
            Export Standings CSV
          </button>
          <Scorecard />
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          Saving stores the tournament in your browser for later review. Export creates a downloadable file.
        </p>
      </section>

      {/* Pairing Log */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-display font-semibold">Swiss Pairing Log</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              View detailed decisions made by the pairing algorithm
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPairingLog(!showPairingLog)}
              className="btn btn-secondary text-sm"
            >
              {showPairingLog ? 'Hide Log' : 'View Log'}
            </button>
            <button
              onClick={() => downloadLog(tournament.pairingLogs)}
              className="btn btn-secondary text-sm"
              disabled={!tournament.pairingLogs || tournament.pairingLogs.length === 0}
            >
              Download Log
            </button>
          </div>
        </div>

        {showPairingLog && (
          <div className="mt-4">
            {!tournament.pairingLogs || tournament.pairingLogs.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] italic">
                No pairing logs available yet. Logs are generated when rounds are created.
              </p>
            ) : (
              <pre className="p-4 bg-[var(--color-bg-primary)] rounded-lg overflow-x-auto text-xs font-mono text-[var(--color-text-secondary)] max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                {generateLogText(tournament.pairingLogs)}
              </pre>
            )}
          </div>
        )}
      </section>

      {/* Manual Round Entry */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-display font-semibold">Manual Round Entry</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Manually enter match results for previous rounds (data recovery)
            </p>
          </div>
          <button
            onClick={() => setShowManualEntry(true)}
            className="btn btn-secondary"
          >
            Enter Rounds Manually
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Use this if you need to enter results from rounds that were played but not recorded in the app.
          The Swiss algorithm will use this history for future pairings.
        </p>
      </section>

      {/* Tournament History */}
      <section className="card p-6">
        <h3 className="text-lg font-display font-semibold mb-4">Tournament History</h3>
        {savedTournaments.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            No saved tournaments yet. Use "Save Tournament" above to save the current tournament.
          </p>
        ) : (
          <div className="space-y-3">
            {savedTournaments.map((saved) => (
              <div
                key={saved.id}
                className={`p-4 rounded-lg border ${saved.id === tournament.id
                  ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30'
                  : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)]'
                  }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-text-primary)] truncate">
                        {saved.name}
                      </span>
                      {saved.id === tournament.id && (
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                          Current
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${saved.status === 'completed'
                        ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                        : saved.status === 'active'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-[var(--color-text-muted)]/20 text-[var(--color-text-muted)]'
                        }`}>
                        {saved.status}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)] mt-1">
                      {saved.playerCount} players | Round {saved.currentRound}/{saved.totalRounds}
                      {saved.winner && (
                        <span className="text-[var(--color-accent)]"> | Winner: {saved.winner}</span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      Last updated: {formatDate(saved.updatedAt)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {saved.id !== tournament.id && (
                      <>
                        {showLoadConfirm === saved.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleLoad(saved.id)}
                              className="btn btn-primary text-xs px-3 py-1"
                            >
                              Confirm Load
                            </button>
                            <button
                              onClick={() => setShowLoadConfirm(null)}
                              className="btn btn-secondary text-xs px-3 py-1"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowLoadConfirm(saved.id)}
                            className="btn btn-secondary text-xs px-3 py-1"
                          >
                            Load
                          </button>
                        )}
                      </>
                    )}
                    {showDeleteConfirm === saved.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(saved.id)}
                          className="btn btn-danger text-xs px-3 py-1"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="btn btn-secondary text-xs px-3 py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(saved.id)}
                        className="text-xs px-3 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Finals Configuration - Quick Access */}
      {tournament.settings.finalsEnabled && (tournament.status === 'active' || tournament.status === 'finals_setup') && (
        <section className="card p-6 border-[var(--color-accent)]/30">
          <h3 className="text-lg font-display font-semibold mb-4">Finals/Bracket Mode</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            {tournament.status === 'finals_setup'
              ? 'Swiss rounds complete! Configure your playoff brackets.'
              : 'Finals Mode is enabled. Complete Swiss rounds to configure brackets.'
            }
          </p>
          <div className="flex gap-3">
            {tournament.status === 'active' && (
              <button
                onClick={() => useTournamentStore.getState().completeTournament()}
                className="btn btn-primary"
              >
                Complete Swiss Rounds
              </button>
            )}
            <button
              onClick={() => useTournamentStore.getState().setViewMode('finals_config')}
              disabled={tournament.status !== 'finals_setup'}
              className={`btn ${tournament.status === 'finals_setup' ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'}`}
            >
              Configure Finals Brackets
            </button>
          </div>
        </section>
      )}

      {/* Danger Zone */}
      <section className="card p-6 border-red-500/30">
        <h3 className="text-lg font-display font-semibold text-red-400 mb-4">Danger Zone</h3>

        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="btn btn-danger"
          >
            Reset Tournament
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-red-400">
              Are you sure you want to reset the tournament? This will delete all players, matches, and standings. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="btn btn-danger"
              >
                Yes, Reset Everything
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Manual Round Entry Modal */}
      {showManualEntry && (
        <ManualRoundEntry onClose={() => setShowManualEntry(false)} socket={socket?.socket} />
      )}
    </div>
  );
}

