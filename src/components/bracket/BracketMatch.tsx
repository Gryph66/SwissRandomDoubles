import { BracketMatch as BracketMatchType } from '../../types';
import { useTournamentStore } from '../../store/tournamentStore';

interface BracketMatchProps {
    match: BracketMatchType;
    onClick: (match: BracketMatchType) => void;
}

export function BracketMatch({ match, onClick }: BracketMatchProps) {
    const { tournament } = useTournamentStore();

    // Get team names
    const getTeamName = (team: [string, string] | null): string => {
        if (!team) return 'TBD';
        const p1 = tournament?.players.find(p => p.id === team[0]);
        const p2 = tournament?.players.find(p => p.id === team[1]);
        return `${p1?.name || 'Unknown'} & ${p2?.name || 'Unknown'}`;
    };

    const isWinner = (score: number | null, opponentScore: number | null) => {
        if (score === null || opponentScore === null) return false;
        return score > opponentScore;
    };

    return (
        <div
            onClick={() => onClick(match)}
            className="w-64 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded overflow-hidden shadow-sm hover:border-[var(--color-accent)] transition-colors cursor-pointer"
        >
            <div className="flex flex-col">
                {/* Team 1 */}
                <div className={`flex justify-between items-center px-3 py-2 border-b border-[var(--color-border)] ${isWinner(match.score1, match.score2) ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold' : ''
                    }`}>
                    <span className="truncate text-sm">{getTeamName(match.team1)}</span>
                    <span className="font-mono text-sm w-6 text-center">{match.score1 ?? '-'}</span>
                </div>

                {/* Team 2 */}
                <div className={`flex justify-between items-center px-3 py-2 ${isWinner(match.score2, match.score1) ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold' : ''
                    }`}>
                    <span className="truncate text-sm">{getTeamName(match.team2)}</span>
                    <span className="font-mono text-sm w-6 text-center">{match.score2 ?? '-'}</span>
                </div>
            </div>
        </div>
    );
}
