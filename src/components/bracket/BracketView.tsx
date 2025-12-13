import { useState, useMemo } from 'react';
import { SingleEliminationBracket, SVGViewer } from '@g-loot/react-tournament-brackets';
import { useTournamentStore } from '../../store/tournamentStore';
import { BracketScoreModal } from './BracketScoreModal';
import { CustomMatch } from './CustomMatch';
import { BracketMatch as BracketMatchType } from '../../types';

export function BracketView() {
    const { tournament, setViewMode } = useTournamentStore();
    const bracketMatches = tournament?.bracketMatches || [];
    const [selectedMatch, setSelectedMatch] = useState<BracketMatchType | null>(null);

    // Group by Pool
    const matchesByPool = useMemo(() => {
        return bracketMatches.reduce((acc, match) => {
            if (!acc[match.poolId]) acc[match.poolId] = [];
            acc[match.poolId].push(match);
            return acc;
        }, {} as Record<string, BracketMatchType[]>);
    }, [bracketMatches]);

    const poolIds = Object.keys(matchesByPool).sort();

    // Convert our bracket data to the library's format
    const convertToLibraryFormat = (matches: BracketMatchType[]) => {
        const getTeamName = (team: [string, string] | null): string => {
            if (!team) return 'TBD';
            const p1 = tournament?.players.find(p => p.id === team[0]);
            const p2 = tournament?.players.find(p => p.id === team[1]);
            return `${p1?.name || '?'} & ${p2?.name || '?'}`;
        };

        // Map our matches to library format
        const libraryMatches = matches.map((match, idx) => ({
            id: idx,
            name: match.round === 'final' ? 'Final' : 
                  match.round === 'third_place' ? '3rd Place' :
                  match.round.includes('semi') ? 'Semifinal' : 'Quarterfinal',
            nextMatchId: null as number | null,
            tournamentRoundText: match.round === 'final' ? 'Final' : 
                                 match.round === 'third_place' ? '3rd Place' :
                                 match.round.includes('semi') ? 'Semifinals' : 'Quarterfinals',
            startTime: '',
            state: (match.score1 !== null && match.score2 !== null) ? 'DONE' : 'SCHEDULED',
            participants: [
                {
                    id: match.team1 ? `${match.team1[0]}-${match.team1[1]}` : 'tbd1',
                    resultText: match.score1 !== null ? (match.score1 > (match.score2 || 0) ? 'Won' : 'Lost') : null,
                    isWinner: match.score1 !== null && match.score2 !== null ? match.score1 > match.score2 : false,
                    status: null,
                    name: getTeamName(match.team1),
                    // Show score if available
                    score: match.score1
                },
                {
                    id: match.team2 ? `${match.team2[0]}-${match.team2[1]}` : 'tbd2',
                    resultText: match.score2 !== null ? (match.score2 > (match.score1 || 0) ? 'Won' : 'Lost') : null,
                    isWinner: match.score1 !== null && match.score2 !== null ? match.score2 > match.score1 : false,
                    status: null,
                    name: getTeamName(match.team2),
                    // Show score if available
                    score: match.score2
                }
            ]
        }));

        // Build the bracket structure with proper nextMatchId links
        const finals = matches.find(m => m.round === 'final');
        const thirdPlace = matches.find(m => m.round === 'third_place');
        
        if (finals) {
            const finalIdx = matches.indexOf(finals);
            
            // Link semis to final
            const s1 = matches.find(m => m.id === finals.sourceMatch1Id);
            const s2 = matches.find(m => m.id === finals.sourceMatch2Id);
            
            if (s1) {
                const s1Idx = matches.indexOf(s1);
                libraryMatches[s1Idx].nextMatchId = finalIdx;
                
                // Link quarters to semi 1
                const q1 = matches.find(m => m.id === s1.sourceMatch1Id);
                const q2 = matches.find(m => m.id === s1.sourceMatch2Id);
                if (q1) libraryMatches[matches.indexOf(q1)].nextMatchId = s1Idx;
                if (q2) libraryMatches[matches.indexOf(q2)].nextMatchId = s1Idx;
            }
            
            if (s2) {
                const s2Idx = matches.indexOf(s2);
                libraryMatches[s2Idx].nextMatchId = finalIdx;
                
                // Link quarters to semi 2
                const q3 = matches.find(m => m.id === s2.sourceMatch1Id);
                const q4 = matches.find(m => m.id === s2.sourceMatch2Id);
                if (q3) libraryMatches[matches.indexOf(q3)].nextMatchId = s2Idx;
                if (q4) libraryMatches[matches.indexOf(q4)].nextMatchId = s2Idx;
            }
        }

        return libraryMatches;
    };

    // handleMatchClick needs to be defined within the map loop to access 'matches'
    // or 'matches' needs to be passed as an argument.
    // For now, we'll define it inside the loop to correctly access 'matches'.

    return (
        <div className="max-w-[95vw] mx-auto p-6 overflow-x-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-display font-bold">Playoff Brackets</h1>
                <button
                    onClick={() => setViewMode('finals_config')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)] transition-colors text-sm font-medium"
                >
                    <span className="text-lg">⚙️</span>
                    Edit Configuration
                </button>
            </div>

            {poolIds.map(poolId => {
                const poolConfig = tournament?.finalsConfig?.poolConfigs.find(c => c.poolId === poolId);
                const matches = matchesByPool[poolId];
                const libraryMatches = convertToLibraryFormat(matches);

                if (matches.length === 0) return null;

                // Calculate bracket dimensions based on number of rounds
                const hasQuarters = matches.some(m => m.round.includes('quarter'));
                const hasSemis = matches.some(m => m.round.includes('semi'));
                const bracketWidth = hasQuarters ? 1400 : hasSemis ? 1000 : 700;
                const bracketHeight = hasQuarters ? 500 : 400;

                const handleMatchClick = (match: any) => {
                    console.log('Match clicked - full object:', match);
                    console.log('Match properties:', Object.keys(match));
                    console.log('Match.match:', match.match);
                    
                    // The library wraps our match in a 'match' property
                    const libraryMatch = match.match || match;
                    const matchId = libraryMatch.id;
                    console.log('Library match:', libraryMatch);
                    console.log('Looking for match with id:', matchId);
                    
                    if (matchId !== undefined && matchId < matches.length) {
                        const originalMatch = matches[matchId];
                        console.log('Original match found:', originalMatch);
                        
                        if (originalMatch && originalMatch.team1 && originalMatch.team2) {
                            console.log('Opening score modal for:', originalMatch);
                            setSelectedMatch(originalMatch);
                        } else {
                            console.log('Match found but missing teams');
                        }
                    } else {
                        console.log('Invalid match ID or out of bounds');
                    }
                };

                return (
                    <div key={poolId} className="card p-8 mb-8 overflow-visible">
                        <h2 className="text-xl font-display font-semibold mb-8 border-b border-[var(--color-border)] pb-3">
                            {poolConfig?.poolName || poolId}
                        </h2>

                        <div className="bracket-container" style={{ minHeight: `${bracketHeight}px` }}>
                            <SingleEliminationBracket
                                matches={libraryMatches}
                                matchComponent={CustomMatch}
                                onMatchClick={handleMatchClick}
                                svgWrapper={({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
                                    <SVGViewer
                                        width={bracketWidth}
                                        height={bracketHeight}
                                        background="transparent"
                                        SVGBackground="transparent"
                                        {...props}
                                    >
                                        {children}
                                    </SVGViewer>
                                )}
                            />
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

            <style>{`
                .bracket-container {
                    width: 100%;
                    overflow-x: auto;
                    overflow-y: visible;
                }
                
                /* Winner team - MUST come before catch-all rule */
                .bracket-container div[class*="j0BCSa"] > div:first-child div[class*="bOrPFB"],
                .bracket-container div[class*="htobDjs"] > div:first-child div[class*="bOrPFB"] {
                    color: #10b981 !important;
                    font-weight: 600 !important;
                }
                
                /* Override library's inline styles for team names - use HTML selectors */
                .bracket-container div[class*="bOrPFB"],
                .bracket-container div[class*="jCaWvF"] {
                    color: #f5f5f5 !important;
                    font-weight: 500 !important;
                }
                
                /* Won label - make it green */
                .bracket-container div[class*="jCaWvF"]:not(:empty):first-of-type {
                    color: #10b981 !important;
                    font-weight: 600 !important;
                }
                
                /* Lost label - make it grey */
                .bracket-container div[class*="jCaWvF"]:last-of-type {
                    color: #6b7280 !important;
                }
                
                /* Match card containers */
                .bracket-container div[class*="htobDjs"],
                .bracket-container div[class*="j0BCSa"] {
                    background-color: #374151 !important;
                    border-color: #6b7280 !important;
                }
                
                /* Winner row background - subtle green glow */
                .bracket-container div[class*="bOrPFB"]:first-child {
                    background: linear-gradient(90deg, rgba(16, 185, 129, 0.1) 0%, transparent 100%) !important;
                }
                
                /* Round labels */
                .bracket-container p[class*="cuySIo"] {
                    color: #d1d5db !important;
                }
                
                /* SVG connector lines */
                .bracket-container svg line,
                .bracket-container svg path {
                    stroke: #9ca3af !important;
                    stroke-width: 2 !important;
                }
                
                /* Override ALL text colors in the bracket to almost white */
                .bracket-container * {
                    color: #f5f5f5 !important;
                }
                
                /* Match Details text */
                .bracket-container div[class*="htMat"] {
                    color: #9ca3af !important;
                }
                
                /* Score display styling */
                .bracket-container div[class*="score"] {
                    color: #fbbf24 !important;
                    font-weight: 600 !important;
                }
            `}</style>
        </div>
    );
}
