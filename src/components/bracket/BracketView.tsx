import { useTournamentStore } from '../../store/tournamentStore';

export function BracketView() {
    const { tournament } = useTournamentStore();
    const brackets = tournament?.bracketMatches || [];

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="card p-6">
                <h1 className="text-2xl font-display font-bold mb-4">Playoff Brackets</h1>
                <p className="text-[var(--color-text-secondary)] mb-6">
                    Brackets generated! {brackets.length} matches scheduled.
                </p>

                <div className="p-4 bg-[var(--color-bg-secondary)] rounded border border-[var(--color-border)]">
                    <pre className="text-xs overflow-auto">
                        {JSON.stringify(brackets, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
}
