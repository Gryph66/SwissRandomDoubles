import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';

export function TableSetup() {
  const { tournament, addTable, removeTable, updateTable } = useTournamentStore();
  const [newTableName, setNewTableName] = useState('');

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

  const addNumberedTables = (count: number) => {
    for (let i = 1; i <= count; i++) {
      addTable(`Table ${i}`);
    }
  };

  const addLetterTables = (count: number) => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < Math.min(count, 26); i++) {
      addTable(`Board ${letters[i]}`);
    }
  };

  const requiredTables = Math.floor(tournament.players.length / 4);

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-semibold">Tables / Boards</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            You'll need at least {requiredTables} table{requiredTables !== 1 ? 's' : ''} for {tournament.players.length} players
          </p>
        </div>
        <span className="text-sm text-[var(--color-text-muted)]">
          {tournament.tables.length} defined
        </span>
      </div>

      {/* Quick Add Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => addNumberedTables(4)}
          className="btn btn-secondary text-sm"
        >
          Add Tables 1-4
        </button>
        <button
          onClick={() => addNumberedTables(8)}
          className="btn btn-secondary text-sm"
        >
          Add Tables 1-8
        </button>
        <button
          onClick={() => addLetterTables(4)}
          className="btn btn-secondary text-sm"
        >
          Add Boards A-D
        </button>
      </div>

      {/* Add Table Form */}
      <div className="flex gap-3 mb-6">
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
        <div className="text-center py-8 text-[var(--color-text-muted)]">
          No tables defined. Use the quick-add buttons or add custom names above.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tournament.tables
            .sort((a, b) => a.order - b.order)
            .map((table) => (
              <div
                key={table.id}
                className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg group"
              >
                <input
                  type="text"
                  value={table.name}
                  onChange={(e) => updateTable(table.id, e.target.value)}
                  className="bg-transparent text-[var(--color-text-primary)] font-medium w-full focus:outline-none"
                />
                <button
                  onClick={() => removeTable(table.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-muted)] 
                           hover:text-red-400 transition-all duration-200 flex-shrink-0"
                  title="Remove table"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

