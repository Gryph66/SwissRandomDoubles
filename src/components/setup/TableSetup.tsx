import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';

interface TableSetupProps {
  socket?: {
    addTable: (name: string) => void;
    removeTable: (tableId: string) => void;
    updateTable: (tableId: string, name: string) => void;
  };
}

export function TableSetup({ socket }: TableSetupProps) {
  const { tournament, addTable: localAddTable, removeTable: localRemoveTable, updateTable: localUpdateTable } = useTournamentStore();
  const [newTableName, setNewTableName] = useState('');
  
  const addTable = socket ? socket.addTable : localAddTable;
  const removeTable = socket ? socket.removeTable : localRemoveTable;
  const updateTable = socket ? socket.updateTable : localUpdateTable;

  if (!tournament) return null;

  const handleAddTable = () => {
    if (newTableName.trim()) {
      addTable(newTableName.trim());
      setNewTableName('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTable();
    }
  };

  const addNumberedTables = (count: number, prefix: string = 'Table') => {
    for (let i = 1; i <= count; i++) {
      addTable(`${prefix} ${i}`);
    }
  };

  const addLetterTables = (count: number, prefix: string = 'Board') => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < Math.min(count, 26); i++) {
      addTable(`${prefix} ${letters[i]}`);
    }
  };

  const clearAllTables = () => {
    tournament.tables.forEach(table => {
      removeTable(table.id);
    });
  };

  // Calculate required tables based on active players
  const activePlayers = tournament.players.filter(p => p.active);
  const playerCount = activePlayers.length;
  const requiredTables = Math.ceil(playerCount / 4);
  const byeCount = playerCount % 4 === 0 ? 0 : 4 - (playerCount % 4);

  // Generate letter for quick-add (A, B, C, D, E based on count)
  const getEndLetter = (count: number) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[count - 1] || 'Z';

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-display font-semibold">Tables / Boards</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {playerCount} players = {requiredTables} table{requiredTables !== 1 ? 's' : ''} needed
            {byeCount > 0 && ` (${byeCount} bye${byeCount !== 1 ? 's' : ''})`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-text-muted)]">
            {tournament.tables.length} defined
          </span>
          {tournament.tables.length > 0 && (
            <button
              onClick={clearAllTables}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Smart Quick Add Buttons - based on player count */}
      {requiredTables > 0 && tournament.tables.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => addNumberedTables(requiredTables, 'Table')}
            className="btn btn-secondary text-sm"
          >
            Add Table 1-{requiredTables}
          </button>
          <button
            onClick={() => addNumberedTables(requiredTables, 'Board')}
            className="btn btn-secondary text-sm"
          >
            Add Board 1-{requiredTables}
          </button>
          <button
            onClick={() => addLetterTables(requiredTables, 'Table')}
            className="btn btn-secondary text-sm"
          >
            Add Table A-{getEndLetter(requiredTables)}
          </button>
          <button
            onClick={() => addLetterTables(requiredTables, 'Board')}
            className="btn btn-secondary text-sm"
          >
            Add Board A-{getEndLetter(requiredTables)}
          </button>
        </div>
      )}

      {/* Add Table Form */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={newTableName}
          onChange={(e) => setNewTableName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Custom table name"
          className="input flex-1"
        />
        <button
          onClick={handleAddTable}
          disabled={!newTableName.trim()}
          className="btn btn-primary"
        >
          Add Table
        </button>
      </div>

      {/* Table List */}
      {tournament.tables.length === 0 ? (
        <div className="text-center py-6 text-[var(--color-text-muted)]">
          No tables defined. Use the quick-add buttons above or add custom names.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tournament.tables
            .sort((a, b) => a.order - b.order)
            .map((table) => (
              <div
                key={table.id}
                className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg"
              >
                <input
                  type="text"
                  value={table.name}
                  onChange={(e) => updateTable(table.id, e.target.value)}
                  className="bg-transparent text-[var(--color-text-primary)] font-medium w-full focus:outline-none"
                />
                <button
                  onClick={() => removeTable(table.id)}
                  className="p-1 text-red-400/60 hover:text-red-400 transition-all duration-200 flex-shrink-0 ml-2"
                  title="Remove table"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
