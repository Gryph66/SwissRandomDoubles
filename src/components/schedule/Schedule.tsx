import { useMemo } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';

export function Schedule() {
  const { tournament, getPlayerById, getCurrentRoundMatches } = useTournamentStore();
  
  const currentMatches = useMemo(() => {
    if (!tournament) return [];
    return getCurrentRoundMatches().filter(m => !m.isBye);
  }, [tournament, getCurrentRoundMatches]);

  const byeMatches = useMemo(() => {
    if (!tournament) return [];
    return getCurrentRoundMatches().filter(m => m.isBye);
  }, [tournament, getCurrentRoundMatches]);

  if (!tournament) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <p className="text-[var(--color-text-muted)]">No tournament in progress</p>
      </div>
    );
  }

  if (tournament.currentRound === 0) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <p className="text-[var(--color-text-muted)] text-xl">Tournament not started yet</p>
      </div>
    );
  }

  const matchCount = currentMatches.length;
  
  // Calculate grid layout based on match count
  // Goal: fit all matches in viewport without scrolling
  // For 16 matches: 4x4 grid, for fewer: adjust to be larger
  const getGridConfig = () => {
    if (matchCount <= 4) return { cols: 2, rows: 2 };
    if (matchCount <= 6) return { cols: 3, rows: 2 };
    if (matchCount <= 8) return { cols: 4, rows: 2 };
    if (matchCount <= 9) return { cols: 3, rows: 3 };
    if (matchCount <= 12) return { cols: 4, rows: 3 };
    if (matchCount <= 16) return { cols: 4, rows: 4 };
    if (matchCount <= 20) return { cols: 5, rows: 4 };
    return { cols: 6, rows: 4 }; // Max for very large tournaments
  };

  const { cols } = getGridConfig();

  // Get player name helper
  const getPlayerName = (id: string | undefined): string => {
    if (!id) return '';
    const player = getPlayerById(id);
    return player?.name || 'Unknown';
  };

  // Get table/match label
  const getMatchLabel = (match: typeof currentMatches[0], index: number): string => {
    if (match.tableId) {
      const table = tournament.tables.find(t => t.id === match.tableId);
      return table?.name || `Table ${index + 1}`;
    }
    return `Match ${index + 1}`;
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-4">
      {/* Round Header */}
      <div className="text-center mb-4 flex-shrink-0">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-[var(--color-accent)]">
          Round {tournament.currentRound}
        </h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">
          {matchCount} matches {byeMatches.length > 0 && `• ${byeMatches.length} bye${byeMatches.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Desktop: Fixed grid that scales to fit */}
      <div className="hidden md:flex flex-1 items-center justify-center overflow-hidden">
        <div 
          className="w-full h-full grid gap-3 p-2"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridAutoRows: '1fr',
          }}
        >
          {currentMatches.map((match, index) => (
            <div
              key={match.id}
              className={`
                relative flex flex-col justify-center
                bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)]
                border-2 rounded-xl overflow-hidden
                ${match.completed 
                  ? 'border-[var(--color-success)]/50' 
                  : 'border-[var(--color-accent)]/30 hover:border-[var(--color-accent)]/60'}
                transition-all duration-200
              `}
            >
              {/* Match Label */}
              <div className="absolute top-0 left-0 right-0 bg-[var(--color-bg-primary)]/80 px-2 py-1">
                <span className="text-xs font-bold tracking-wider text-[var(--color-accent)] uppercase">
                  {getMatchLabel(match, index)}
                </span>
              </div>

              {/* Teams */}
              <div className="flex-1 flex flex-col justify-center px-3 pt-6 pb-2">
                {/* Team 1 */}
                <div className="text-center mb-1">
                  <span className="text-[clamp(0.75rem,2vw,1.25rem)] font-semibold text-[var(--color-text-primary)] leading-tight">
                    {getPlayerName(match.team1[0])}
                  </span>
                  <span className="text-[clamp(0.6rem,1.5vw,1rem)] text-[var(--color-text-muted)] mx-1">&</span>
                  <span className="text-[clamp(0.75rem,2vw,1.25rem)] font-semibold text-[var(--color-text-primary)] leading-tight">
                    {getPlayerName(match.team1[1])}
                  </span>
                </div>

                {/* VS Divider */}
                <div className="text-center my-1">
                  <span className="text-[clamp(0.5rem,1vw,0.75rem)] font-bold text-[var(--color-accent)] tracking-widest">
                    VS
                  </span>
                </div>

                {/* Team 2 */}
                <div className="text-center">
                  <span className="text-[clamp(0.75rem,2vw,1.25rem)] font-semibold text-[var(--color-text-primary)] leading-tight">
                    {match.team2 && getPlayerName(match.team2[0])}
                  </span>
                  <span className="text-[clamp(0.6rem,1.5vw,1rem)] text-[var(--color-text-muted)] mx-1">&</span>
                  <span className="text-[clamp(0.75rem,2vw,1.25rem)] font-semibold text-[var(--color-text-primary)] leading-tight">
                    {match.team2 && getPlayerName(match.team2[1])}
                  </span>
                </div>

                {/* Score if completed */}
                {match.completed && match.score1 !== null && (
                  <div className="absolute bottom-1 left-0 right-0 text-center">
                    <span className="text-xs font-bold text-[var(--color-success)]">
                      {match.score1} - {match.score2}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: Scrollable stacked list */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3 pb-4">
        {currentMatches.map((match, index) => (
          <div
            key={match.id}
            className={`
              p-4 rounded-xl
              bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)]
              border-2
              ${match.completed 
                ? 'border-[var(--color-success)]/50' 
                : 'border-[var(--color-accent)]/30'}
            `}
          >
            {/* Match Label */}
            <div className="text-center mb-2">
              <span className="text-xs font-bold tracking-wider text-[var(--color-accent)] uppercase">
                {getMatchLabel(match, index)}
              </span>
            </div>

            {/* Teams */}
            <div className="text-center">
              {/* Team 1 */}
              <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                {getPlayerName(match.team1[0])} <span className="text-[var(--color-text-muted)]">&</span> {getPlayerName(match.team1[1])}
              </div>

              {/* VS */}
              <div className="text-sm font-bold text-[var(--color-accent)] tracking-widest my-1">
                VS
              </div>

              {/* Team 2 */}
              <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                {match.team2 && getPlayerName(match.team2[0])} <span className="text-[var(--color-text-muted)]">&</span> {match.team2 && getPlayerName(match.team2[1])}
              </div>

              {/* Score if completed */}
              {match.completed && match.score1 !== null && (
                <div className="mt-2 text-sm font-bold text-[var(--color-success)]">
                  Final: {match.score1} - {match.score2}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Byes section for mobile */}
        {byeMatches.length > 0 && (
          <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)]/50 border border-dashed border-[var(--color-border)]">
            <div className="text-center text-sm text-[var(--color-text-muted)]">
              <span className="font-medium">Bye this round:</span>{' '}
              {byeMatches.map(m => getPlayerName(m.team1[0])).join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Byes footer */}
      {byeMatches.length > 0 && (
        <div className="hidden md:block text-center py-2 flex-shrink-0">
          <span className="text-sm text-[var(--color-text-muted)]">
            <span className="font-medium">Bye:</span>{' '}
            {byeMatches.map(m => getPlayerName(m.team1[0])).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

