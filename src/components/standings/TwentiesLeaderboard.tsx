import { useTournamentStore } from '../../store/tournamentStore';

export function TwentiesLeaderboard() {
  const { tournament } = useTournamentStore();

  if (!tournament) return null;

  // Sort players by twenties
  const twentiesRanking = [...tournament.players]
    .filter((p) => p.active && p.twenties > 0)
    .sort((a, b) => b.twenties - a.twenties);

  if (twentiesRanking.length === 0) {
    return null;
  }

  const isComplete = tournament.status === 'completed';
  const champion = twentiesRanking[0];

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-display font-semibold">
          {isComplete ? '20s Champion' : '20s Leaderboard'}
        </h3>
        {isComplete && champion && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-muted)]">Champion:</span>
            <span className="px-3 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full font-semibold">
              {champion.name}
            </span>
          </div>
        )}
      </div>

      {/* Top 3 Podium (for completed tournaments) */}
      {isComplete && twentiesRanking.length >= 3 && (
        <div className="flex items-end justify-center gap-4 mb-8">
          {/* 2nd Place */}
          <div className="text-center">
            <div className="w-24 h-20 bg-gray-400/20 rounded-t-lg flex items-center justify-center">
              <span className="text-3xl font-bold text-gray-300">2</span>
            </div>
            <div className="p-3 bg-[var(--color-bg-tertiary)] rounded-b-lg">
              <p className="font-medium text-[var(--color-text-primary)] truncate">
                {twentiesRanking[1].name}
              </p>
              <p className="text-lg font-mono text-[var(--color-accent)]">
                {twentiesRanking[1].twenties}
              </p>
            </div>
          </div>

          {/* 1st Place */}
          <div className="text-center">
            <div className="w-28 h-28 bg-yellow-500/20 rounded-t-lg flex items-center justify-center">
              <span className="text-4xl font-bold text-yellow-400">1</span>
            </div>
            <div className="p-3 bg-[var(--color-bg-tertiary)] rounded-b-lg">
              <p className="font-semibold text-[var(--color-accent)] truncate">
                {twentiesRanking[0].name}
              </p>
              <p className="text-xl font-mono text-[var(--color-accent)]">
                {twentiesRanking[0].twenties}
              </p>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="text-center">
            <div className="w-24 h-16 bg-amber-600/20 rounded-t-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-amber-500">3</span>
            </div>
            <div className="p-3 bg-[var(--color-bg-tertiary)] rounded-b-lg">
              <p className="font-medium text-[var(--color-text-primary)] truncate">
                {twentiesRanking[2].name}
              </p>
              <p className="text-lg font-mono text-[var(--color-accent)]">
                {twentiesRanking[2].twenties}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Full List */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {twentiesRanking.map((player, index) => (
          <div
            key={player.id}
            className={`
              flex items-center gap-3 p-3 rounded-lg
              ${index === 0 ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30' : 'bg-[var(--color-bg-tertiary)]'}
            `}
          >
            <span className={`
              text-sm font-mono
              ${index === 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}
            `}>
              #{index + 1}
            </span>
            <span className={`
              flex-1 truncate font-medium
              ${index === 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}
            `}>
              {player.name}
            </span>
            <span className={`
              font-mono font-bold
              ${index === 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}
            `}>
              {player.twenties}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

