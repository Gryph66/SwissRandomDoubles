import { useTournamentStore } from '../../store/tournamentStore';
import { exportPageToPng } from '../../utils/exportPng';

interface RoundViewProps {
  socket?: {
    generateNextRound: () => void;
    completeTournament: () => void;
  };
}

export function RoundView({ socket }: RoundViewProps) {
  const { 
    tournament, 
    getMatchesByRound,
    getPlayerById,
    generateNextRound: localGenerateNextRound,
    completeTournament: localCompleteTournament,
    getCurrentRoundMatches,
  } = useTournamentStore();
  
  const generateNextRound = socket ? socket.generateNextRound : localGenerateNextRound;
  const completeTournament = socket ? socket.completeTournament : localCompleteTournament;

  if (!tournament) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-text-muted)]">No tournament in progress</p>
      </div>
    );
  }

  const currentMatches = getCurrentRoundMatches();
  const allCurrentComplete = currentMatches.every((m) => m.completed);
  const isLastRound = tournament.currentRound >= tournament.totalRounds;
  const maxRound = tournament.status === 'completed' ? tournament.totalRounds : tournament.currentRound;

  const handleNextRound = () => {
    if (isLastRound) {
      completeTournament();
    } else {
      generateNextRound();
    }
  };

  // Get all rounds data
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);

  return (
    <div id="round-results-export" className="p-4">
      {/* Header with action button */}
      <div className="flex items-center justify-between mb-6 max-w-full flex-wrap gap-2">
        <div>
          <h2 className="text-3xl font-display font-bold">Score Summary</h2>
          <p className="text-lg text-[var(--color-text-secondary)]">
            {tournament.status === 'completed' 
              ? 'Tournament Complete' 
              : `Round ${tournament.currentRound} of ${tournament.totalRounds}`
            }
          </p>
        </div>
        <button
          onClick={() => exportPageToPng('round-results-export', `${tournament.name}-round-results`)}
          className="btn btn-secondary text-sm flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export PNG
        </button>
        
        {tournament.status !== 'completed' && allCurrentComplete && (
          <button
            onClick={handleNextRound}
            className="btn btn-primary text-lg px-6 py-3"
          >
            {isLastRound ? 'Complete Tournament' : `Start Round ${tournament.currentRound + 1}`}
          </button>
        )}
      </div>

      {/* Challonge-style horizontal rounds */}
      <div className="overflow-x-auto pb-4">
        <div className="inline-flex gap-2 min-w-full px-1">
          {rounds.map((round) => {
            const matches = getMatchesByRound(round).filter((m) => !m.isBye);
            const byeMatches = getMatchesByRound(round).filter((m) => m.isBye);
            const isCurrentRound = round === tournament.currentRound && tournament.status !== 'completed';

            return (
              <div 
                key={round} 
                className={`
                  flex-shrink-0 w-56
                  ${isCurrentRound ? 'ring-2 ring-[var(--color-accent)] rounded-lg' : ''}
                `}
              >
                {/* Round Header */}
                <div className={`
                  text-center py-3 mb-3 rounded-t-lg
                  ${isCurrentRound 
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]' 
                    : 'border-b-2 border-[var(--color-border)]'
                  }
                `}>
                  <h3 className={`
                    text-lg font-bold uppercase tracking-wider
                    ${isCurrentRound ? '' : 'text-[var(--color-text-secondary)]'}
                  `}>
                    Round {round}
                  </h3>
                </div>

                {/* Matches */}
                <div className="space-y-2">
                  {matches.map((match, matchIdx) => {
                    const team1Names = match.team1.map((id) => getPlayerById(id)?.name ?? '?');
                    const team2Names = match.team2?.map((id) => getPlayerById(id)?.name ?? '?') ?? [];

                    const isTeam1Winner = match.score1 !== null && match.score2 !== null && match.score1 > match.score2;
                    const isTeam2Winner = match.score1 !== null && match.score2 !== null && match.score2 > match.score1;
                    const isTie = match.score1 !== null && match.score2 !== null && match.score1 === match.score2;

                    return (
                      <div
                        key={match.id}
                        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg overflow-hidden"
                      >
                        {/* Team 1 */}
                        <div className={`
                          flex items-center justify-between px-2 py-1.5
                          ${isTeam1Winner ? 'bg-[var(--color-accent)]/15' : ''}
                        `}>
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <span className="text-xs text-[var(--color-text-muted)] w-4 flex-shrink-0 font-mono">
                              {matchIdx + 1}
                            </span>
                            <span className={`
                              text-sm font-medium truncate
                              ${isTeam1Winner ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}
                            `}>
                              {team1Names.join(' + ')}
                            </span>
                          </div>
                          <span className={`
                            ml-1 px-1.5 py-0.5 rounded text-sm font-mono font-bold flex-shrink-0 min-w-[1.5rem] text-center
                            ${isTeam1Winner 
                              ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]' 
                              : isTie 
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'text-[var(--color-text-muted)]'
                            }
                          `}>
                            {match.score1 ?? '-'}
                          </span>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-[var(--color-border)]" />

                        {/* Team 2 */}
                        <div className={`
                          flex items-center justify-between px-2 py-1.5
                          ${isTeam2Winner ? 'bg-[var(--color-accent)]/15' : ''}
                        `}>
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <span className="w-4 flex-shrink-0" />
                            <span className={`
                              text-sm font-medium truncate
                              ${isTeam2Winner ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}
                            `}>
                              {team2Names.join(' + ')}
                            </span>
                          </div>
                          <span className={`
                            ml-1 px-1.5 py-0.5 rounded text-sm font-mono font-bold flex-shrink-0 min-w-[1.5rem] text-center
                            ${isTeam2Winner 
                              ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]' 
                              : isTie 
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'text-[var(--color-text-muted)]'
                            }
                          `}>
                            {match.score2 ?? '-'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Byes */}
                {byeMatches.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                    <div className="text-sm text-[var(--color-text-muted)] mb-1 font-medium">Bye:</div>
                    {byeMatches.map((match) => (
                      <div key={match.id} className="text-base text-[var(--color-text-secondary)]">
                        {getPlayerById(match.team1[0])?.name ?? 'Unknown'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex gap-8 text-base text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[var(--color-accent)] text-[var(--color-bg-primary)] font-mono font-bold">5</span>
          <span>Winner</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[var(--color-text-muted)] font-mono font-bold">3</span>
          <span>Loser</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold">4</span>
          <span>Tie</span>
        </div>
      </div>
    </div>
  );
}
