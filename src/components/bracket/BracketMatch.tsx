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

    const hasScore = match.score1 !== null && match.score2 !== null;
    const team1Won = isWinner(match.score1, match.score2);
    const team2Won = isWinner(match.score2, match.score1);

    // Status styles
    const containerClass = `
    w-64 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shadow-md
    ${hasScore
            ? 'bg-[#1e1e24] border-gray-700'
            : 'bg-[#2a2a35] border-transparent hover:border-gray-600'
        }
    ${match.team1 && match.team2 ? '' : 'opacity-70'}
  `;

    // Team row styles
    const getTeamClass = (isWon: boolean) => `
    flex justify-between items-center px-4 py-3
    ${isWon
            ? 'bg-green-500/10 text-green-400'
            : 'text-gray-300'
        }
  `;

    return (
        <div onClick={() => onClick(match)} className={containerClass}>
            <div className="flex flex-col divide-y divide-gray-700/50">
                {/* Team 1 */}
                <div className={getTeamClass(team1Won)}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="truncate text-sm font-medium">{getTeamName(match.team1)}</span>
                        {team1Won && <span className="text-xs">✓</span>}
                    </div>
                    <span className={`font-mono text-sm font-bold ${team1Won ? 'text-green-400' : 'text-gray-500'}`}>
                        {match.score1 ?? '-'}
                    </span>
                </div>

                {/* Team 2 */}
                <div className={getTeamClass(team2Won)}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="truncate text-sm font-medium">{getTeamName(match.team2)}</span>
                        {team2Won && <span className="text-xs">✓</span>}
                    </div>
                    <span className={`font-mono text-sm font-bold ${team2Won ? 'text-green-400' : 'text-gray-500'}`}>
                        {match.score2 ?? '-'}
                    </span>
                </div>
            </div>
        </div>
    );
}
