import { useState } from 'react';
import { BracketMatch } from '../../types';
import { useTournamentStore } from '../../store/tournamentStore';

interface BracketScoreModalProps {
    match: BracketMatch;
    onClose: () => void;
}

export function BracketScoreModal({ match, onClose }: BracketScoreModalProps) {
    const { tournament, submitBracketScore } = useTournamentStore();
    const [score1, setScore1] = useState<string>(match.score1?.toString() || '0');
    const [score2, setScore2] = useState<string>(match.score2?.toString() || '0');
    const [twenties1, setTwenties1] = useState<string>(match.twenties1?.toString() || '0');
    const [twenties2, setTwenties2] = useState<string>(match.twenties2?.toString() || '0');
    const [error, setError] = useState<string | null>(null);

    // Get team names
    const getTeamName = (team: [string, string] | null): string => {
        if (!team) return 'TBD';
        const p1 = tournament?.players.find(p => p.id === team[0]);
        const p2 = tournament?.players.find(p => p.id === team[1]);
        return `${p1?.name || 'Unknown'} & ${p2?.name || 'Unknown'}`;
    };

    const name1 = getTeamName(match.team1);
    const name2 = getTeamName(match.team2);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const s1 = parseInt(score1);
        const s2 = parseInt(score2);
        const t1 = parseInt(twenties1);
        const t2 = parseInt(twenties2);

        if (isNaN(s1) || isNaN(s2) || isNaN(t1) || isNaN(t2)) {
            setError('Please enter valid numbers');
            return;
        }

        if (s1 === s2) {
            setError('Ties are not allowed in bracket matches. Play a tiebreaker!');
            return;
        }

        submitBracketScore(match.id, s1, s2, t1, t2);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="card w-full max-w-lg p-6 animate-fade-in relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                    ✕
                </button>

                <h2 className="text-xl font-display font-bold mb-1">Enter Match Result</h2>
                <p className="text-sm text-[var(--color-text-muted)] mb-6">
                    {match.round.charAt(0).toUpperCase() + match.round.slice(1)} Match #{match.matchNumber}
                </p>

                {error && (
                    <div className="bg-red-500/10 text-red-500 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-8">
                        {/* Team 1 */}
                        <div className="space-y-3">
                            <div className="font-semibold text-center h-12 flex items-center justify-center">
                                {name1}
                            </div>
                            <div>
                                <label className="label text-xs mb-1">Score</label>
                                <input
                                    type="number"
                                    value={score1}
                                    onChange={(e) => setScore1(e.target.value)}
                                    className="input text-center text-lg font-bold"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="label text-xs mb-1">20s</label>
                                <input
                                    type="number"
                                    value={twenties1}
                                    onChange={(e) => setTwenties1(e.target.value)}
                                    className="input text-center"
                                />
                            </div>
                        </div>

                        {/* Team 2 */}
                        <div className="space-y-3">
                            <div className="font-semibold text-center h-12 flex items-center justify-center">
                                {name2}
                            </div>
                            <div>
                                <label className="label text-xs mb-1">Score</label>
                                <input
                                    type="number"
                                    value={score2}
                                    onChange={(e) => setScore2(e.target.value)}
                                    className="input text-center text-lg font-bold"
                                />
                            </div>
                            <div>
                                <label className="label text-xs mb-1">20s</label>
                                <input
                                    type="number"
                                    value={twenties2}
                                    onChange={(e) => setTwenties2(e.target.value)}
                                    className="input text-center"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                        >
                            Submit Result
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
