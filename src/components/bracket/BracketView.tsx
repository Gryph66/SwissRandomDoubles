import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import { BracketMatch } from './BracketMatch';
import { BracketScoreModal } from './BracketScoreModal';
import { BracketMatch as BracketMatchType } from '../../types';

export function BracketView() {
    const { tournament } = useTournamentStore();
    const bracketMatches = tournament?.bracketMatches || [];
    const [selectedMatch, setSelectedMatch] = useState<BracketMatchType | null>(null);

    // Group by Pool
    const matchesByPool = bracketMatches.reduce((acc, match) => {
        if (!acc[match.poolId]) acc[match.poolId] = [];
        acc[match.poolId].push(match);
        return acc;
    }, {} as Record<string, BracketMatchType[]>);

    // Helper to filter matches by round
    const getMatchesByRound = (matches: BracketMatchType[], round: string) => {
        return matches
            .filter(m => m.round === round)
            .sort((a, b) => a.matchNumber - b.matchNumber);
    };

    const poolIds = Object.keys(matchesByPool).sort();

    const handleMatchClick = (match: BracketMatchType) => {
        if (!match.team1 || !match.team2) return; // Can't score if teams aren't set
        setSelectedMatch(match);
    };

    return (
        <div className="max-w-[95vw] mx-auto p-6 overflow-x-auto">
            <h1 className="text-2xl font-display font-bold mb-6">Playoff Brackets</h1>

            {poolIds.map(poolId => {
                const poolConfig = tournament?.finalsConfig?.poolConfigs.find(c => c.poolId === poolId);
                const matches = matchesByPool[poolId];

                const quarters = getMatchesByRound(matches, 'quarterfinal');
                const semis = getMatchesByRound(matches, 'semifinal');
                const final = getMatchesByRound(matches, 'final');
                const thirdPlace = getMatchesByRound(matches, 'third_place');

                return (
                    <div key={poolId} className="card p-8 mb-8 min-w-[800px]">
                        <h2 className="text-xl font-display font-semibold mb-6 border-b border-[var(--color-border)] pb-2">
                            {poolConfig?.poolName || poolId}
                        </h2>

                        <div className="flex justify-around relative">

                            {/* Quarterfinals Column */}
                            {quarters.length > 0 && (
                                <div className="flex flex-col justify-around gap-8">
                                    <h3 className="text-center text-sm font-medium text-[var(--color-text-muted)] mb-2">Quarterfinals</h3>
                                    {quarters.map(match => (
                                        <div key={match.id} className="relative">
                                            <BracketMatch match={match} onClick={handleMatchClick} />
                                            {/* Connector Line to Right */}
                                            <div className="absolute top-1/2 -right-8 w-8 h-px bg-[var(--color-border)]"></div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Semifinals Column */}
                            {semis.length > 0 && (
                                <div className="flex flex-col justify-around gap-16">
                                    <h3 className="text-center text-sm font-medium text-[var(--color-text-muted)] mb-2">Semifinals</h3>
                                    {semis.map((match) => (
                                        <div key={match.id} className="relative">
                                            {/* Connector Line from Left (if coming from Quarters) */}
                                            {quarters.length > 0 && (
                                                <div className="absolute top-1/2 -left-8 w-8 h-px bg-[var(--color-border)]"></div>
                                            )}

                                            <BracketMatch match={match} onClick={handleMatchClick} />

                                            {/* Connector Line to Right */}
                                            <div className="absolute top-1/2 -right-8 w-8 h-px bg-[var(--color-border)]"></div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Finals Column (includes 3rd place below) */}
                            <div className="flex flex-col justify-center gap-8">
                                <h3 className="text-center text-sm font-medium text-[var(--color-text-muted)] mb-2">Final</h3>
                                {final.map(match => (
                                    <div key={match.id} className="relative">
                                        {/* Connector Line from Left (if coming from Semis) */}
                                        {semis.length > 0 && (
                                            <div className="absolute top-1/2 -left-8 w-8 h-px bg-[var(--color-border)]"></div>
                                        )}
                                        <BracketMatch match={match} onClick={handleMatchClick} />
                                    </div>
                                ))}

                                {/* 3rd Place Match */}
                                {thirdPlace.length > 0 && (
                                    <div className="mt-8 pt-8 border-t border-[var(--color-border)] border-dashed">
                                        <h3 className="text-center text-xs font-medium text-[var(--color-text-muted)] mb-2">3rd Place Match</h3>
                                        {thirdPlace.map(match => (
                                            <BracketMatch key={match.id} match={match} onClick={handleMatchClick} />
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                );
            })}

            {selectedMatch && (
                <BracketScoreModal
                    match={selectedMatch}
                    onClose={() => setSelectedMatch(null)}
                />
            )}
        </div>
    );
}
