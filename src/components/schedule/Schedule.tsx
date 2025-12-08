import { useMemo, useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';

export function Schedule() {
  const { tournament, getPlayerById, getMatchesByRound } = useTournamentStore();
  const [viewRound, setViewRound] = useState<number | null>(null);
  
  // Use viewRound if set, otherwise current round
  const displayRound = viewRound ?? tournament?.currentRound ?? 0;
  
  const currentMatches = useMemo(() => {
    if (!tournament || displayRound === 0) return [];
    return getMatchesByRound(displayRound).filter(m => !m.isBye);
  }, [tournament, displayRound, getMatchesByRound]);

  const byeMatches = useMemo(() => {
    if (!tournament || displayRound === 0) return [];
    return getMatchesByRound(displayRound).filter(m => m.isBye);
  }, [tournament, displayRound, getMatchesByRound]);

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

  const maxRound = tournament.currentRound;

  // Total items = matches + bye boxes
  const totalItems = currentMatches.length + byeMatches.length;
  
  // Calculate grid layout
  const getGridConfig = () => {
    if (totalItems <= 4) return { cols: 2 };
    if (totalItems <= 6) return { cols: 3 };
    if (totalItems <= 8) return { cols: 4 };
    if (totalItems <= 9) return { cols: 3 };
    if (totalItems <= 12) return { cols: 4 };
    if (totalItems <= 16) return { cols: 4 };
    if (totalItems <= 20) return { cols: 5 };
    return { cols: 6 };
  };

  const { cols } = getGridConfig();

  // Get player name helper
  const getPlayerName = (id: string | undefined): string => {
    if (!id) return '';
    const player = getPlayerById(id);
    return player?.name || 'Unknown';
  };

  // Get table/match label - use table name if assigned, otherwise match number
  const getMatchLabel = (match: typeof currentMatches[0], index: number): string => {
    if (match.tableId) {
      const table = tournament.tables.find(t => t.id === match.tableId);
      if (table) return table.name;
    }
    return `Match ${index + 1}`;
  };

  const handlePrevRound = () => {
    const current = viewRound ?? tournament.currentRound;
    if (current > 1) {
      setViewRound(current - 1);
    }
  };

  const handleNextRound = () => {
    const current = viewRound ?? tournament.currentRound;
    if (current < maxRound) {
      setViewRound(current + 1);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-2 md:p-4">
      {/* Round Header with Navigation */}
      <div className="text-center mb-3 flex-shrink-0">
        <div className="flex items-center justify-center gap-4 mb-2">
          <button
            onClick={handlePrevRound}
            disabled={displayRound <= 1}
            className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] 
                     hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed
                     transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          
          <h1 className="text-3xl md:text-4xl font-display font-bold text-[var(--color-accent)]">
            Round {displayRound}
          </h1>
          
          <button
            onClick={handleNextRound}
            disabled={displayRound >= maxRound}
            className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] 
                     hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed
                     transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
        
        {/* Instruction text */}
        <p className="text-[var(--color-text-muted)] text-sm mb-2">
          Find your name and go to your assigned board
        </p>
        
        {/* Round pills */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => (
            <button
              key={round}
              onClick={() => setViewRound(round)}
              className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                round === displayRound
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              {round}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: Fixed grid that scales to fit */}
      <div className="hidden md:flex flex-1 items-center justify-center overflow-hidden">
        <div 
          className="w-full h-full grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridAutoRows: '1fr',
          }}
        >
          {/* Regular Matches */}
          {currentMatches.map((match, index) => (
            <div
              key={match.id}
              className={`
                relative flex flex-col justify-center items-center
                bg-[var(--color-bg-secondary)] rounded-lg
                border-2 ${match.completed ? 'border-[var(--color-success)]' : 'border-[var(--color-accent)]/40'}
              `}
            >
              {/* Match Label - Larger */}
              <div className="absolute top-2 left-0 right-0 text-center">
                <span className="text-sm md:text-base font-bold tracking-wider text-[var(--color-accent)] uppercase">
                  {getMatchLabel(match, index)}
                </span>
              </div>

              {/* Teams - Centered, Large */}
              <div className="flex flex-col justify-center items-center px-2 w-full">
                {/* Team 1 */}
                <div className="text-center leading-none">
                  <span className="text-[clamp(1rem,2.5vw,1.5rem)] font-bold text-[var(--color-text-primary)]">
                    {getPlayerName(match.team1[0])}
                  </span>
                  <span className="text-[clamp(0.8rem,2vw,1.2rem)] text-[var(--color-text-muted)] mx-1">&</span>
                  <span className="text-[clamp(1rem,2.5vw,1.5rem)] font-bold text-[var(--color-text-primary)]">
                    {getPlayerName(match.team1[1])}
                  </span>
                </div>

                {/* VS */}
                <div className="text-[clamp(0.6rem,1.2vw,0.8rem)] font-bold text-[var(--color-accent)] tracking-widest my-0.5">
                  vs
                </div>

                {/* Team 2 */}
                <div className="text-center leading-none">
                  <span className="text-[clamp(1rem,2.5vw,1.5rem)] font-bold text-[var(--color-text-primary)]">
                    {match.team2 && getPlayerName(match.team2[0])}
                  </span>
                  <span className="text-[clamp(0.8rem,2vw,1.2rem)] text-[var(--color-text-muted)] mx-1">&</span>
                  <span className="text-[clamp(1rem,2.5vw,1.5rem)] font-bold text-[var(--color-text-primary)]">
                    {match.team2 && getPlayerName(match.team2[1])}
                  </span>
                </div>
              </div>

              {/* Score if completed */}
              {match.completed && match.score1 !== null && (
                <div className="absolute bottom-1 left-0 right-0 text-center">
                  <span className="text-[clamp(0.7rem,1.5vw,1rem)] font-bold text-[var(--color-success)]">
                    {match.score1} - {match.score2}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Bye Boxes - Purple styling */}
          {byeMatches.map((match, index) => (
            <div
              key={match.id}
              className="
                relative flex flex-col justify-center items-center
                bg-purple-900/30 rounded-lg
                border-2 border-purple-500/50
              "
            >
              {/* BYE Label - Larger */}
              <div className="absolute top-2 left-0 right-0 text-center">
                <span className="text-sm md:text-base font-bold tracking-wider text-purple-400 uppercase">
                  Bye {byeMatches.length > 1 ? index + 1 : ''}
                </span>
              </div>

              {/* Player Name - Centered, Large */}
              <div className="text-center px-2">
                <span className="text-[clamp(1rem,2.5vw,1.5rem)] font-bold text-purple-300">
                  {getPlayerName(match.team1[0])}
                </span>
              </div>

              {/* Bye info */}
              <div className="absolute bottom-1 left-0 right-0 text-center">
                <span className="text-[clamp(0.6rem,1.2vw,0.8rem)] text-purple-400/70">
                  4-4 tie
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: Scrollable stacked list */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-2 pb-4">
        {currentMatches.map((match, index) => (
          <div
            key={match.id}
            className={`
              p-3 rounded-lg bg-[var(--color-bg-secondary)]
              border-2 ${match.completed ? 'border-[var(--color-success)]' : 'border-[var(--color-accent)]/40'}
            `}
          >
            {/* Match Label */}
            <div className="text-sm font-bold tracking-wider text-[var(--color-accent)] uppercase mb-1 text-center">
              {getMatchLabel(match, index)}
            </div>

            {/* Teams */}
            <div className="text-center">
              <div className="text-base font-bold text-[var(--color-text-primary)]">
                {getPlayerName(match.team1[0])} <span className="text-[var(--color-text-muted)]">&</span> {getPlayerName(match.team1[1])}
              </div>
              <div className="text-xs font-bold text-[var(--color-accent)] my-0.5">vs</div>
              <div className="text-base font-bold text-[var(--color-text-primary)]">
                {match.team2 && getPlayerName(match.team2[0])} <span className="text-[var(--color-text-muted)]">&</span> {match.team2 && getPlayerName(match.team2[1])}
              </div>
              {match.completed && match.score1 !== null && (
                <div className="text-sm font-bold text-[var(--color-success)] mt-1">
                  {match.score1} - {match.score2}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Bye cards for mobile */}
        {byeMatches.map((match, index) => (
          <div
            key={match.id}
            className="p-3 rounded-lg bg-purple-900/30 border-2 border-purple-500/50"
          >
            <div className="text-sm font-bold tracking-wider text-purple-400 uppercase mb-1 text-center">
              Bye {byeMatches.length > 1 ? index + 1 : ''}
            </div>
            <div className="text-center">
              <span className="text-base font-bold text-purple-300">
                {getPlayerName(match.team1[0])}
              </span>
              <span className="text-xs text-purple-400/70 ml-2">(4-4 tie)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
