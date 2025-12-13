import { useState } from 'react';
import { BracketMatch } from '../../types';
import { useTournamentStore } from '../../store/tournamentStore';

interface BracketScoreModalProps {
    match: BracketMatch;
    onClose: () => void;
}

export function BracketScoreModal({ match, onClose }: BracketScoreModalProps) {
    const { tournament, submitBracketScore } = useTournamentStore();
    const [score1, setScore1] = useState<string>(match.score1?.toString() || '');
    const [score2, setScore2] = useState<string>(match.score2?.toString() || '');
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

        if (isNaN(s1) || isNaN(s2)) {
            setError('Please enter valid scores');
            return;
        }

        if (s1 === s2) {
            setError('Ties are not allowed in bracket matches. Play a tiebreaker!');
            return;
        }

        submitBracketScore(match.id, s1, s2, 0, 0); // 0, 0 for 20s since we don't track them
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="card w-full max-w-lg p-6 animate-fade-in relative bg-[#1e1e24] border border-gray-700">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    ✕
                </button>

                <h2 className="text-xl font-display font-bold mb-1">Enter Match Result</h2>
                <p className="text-sm text-gray-400 mb-6">
                    {match.round.charAt(0).toUpperCase() + match.round.slice(1)} Match #{match.matchNumber}
                </p>

                {error && (
                    <div className="bg-red-500/10 text-red-500 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                        {/* Team 1 */}
                        <div className="space-y-3">
                            <div className="font-semibold text-center h-12 flex items-center justify-center text-blue-300">
                                {name1}
                            </div>
                            <div>
                                <label className="block text-xs uppercase tracking-wider text-gray-500 text-center mb-1">Score</label>
                                <input
                                    type="number"
                                    value={score1}
                                    onChange={(e) => setScore1(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded p-4 text-3xl font-bold text-center focus:border-blue-500 focus:outline-none"
                                    autoFocus
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* Team 2 */}
                        <div className="space-y-3">
                            <div className="font-semibold text-center h-12 flex items-center justify-center text-blue-300">
                                {name2}
                            </div>
                            <div>
                                <label className="block text-xs uppercase tracking-wider text-gray-500 text-center mb-1">Score</label>
                                <input
                                    type="number"
                                    value={score2}
                                    onChange={(e) => setScore2(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded p-4 text-3xl font-bold text-center focus:border-blue-500 focus:outline-none"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded border border-gray-600 hover:bg-gray-700 transition-colors"
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
