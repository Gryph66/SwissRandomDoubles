import { useTournamentStore } from '../../store/tournamentStore';
import { TwentiesLeaderboard } from './TwentiesLeaderboard';
import type { Match } from '../../types';

type MatchResult = 'W' | 'L' | 'T' | 'B'; // Win, Loss, Tie, Bye

function getPlayerMatchHistory(playerId: string, matches: Match[]): MatchResult[] {
  const history: MatchResult[] = [];
  
  // Sort matches by round
  const sortedMatches = [...matches].sort((a, b) => a.round - b.round);
  
  for (const match of sortedMatches) {
    // Check if player was in this match
    const inTeam1 = match.team1.includes(playerId);
    const inTeam2 = match.team2?.includes(playerId);
    
    if (!inTeam1 && !inTeam2) continue;
    
    // Handle bye
    if (match.isBye) {
      history.push('B');
      continue;
    }
    
    // Only include completed matches
    if (!match.completed || match.score1 === null || match.score2 === null) continue;
    
    if (inTeam1) {
      if (match.score1 > match.score2) history.push('W');
      else if (match.score1 < match.score2) history.push('L');
      else history.push('T');
    } else if (inTeam2) {
      if (match.score2 > match.score1) history.push('W');
      else if (match.score2 < match.score1) history.push('L');
      else history.push('T');
    }
  }
  
  return history;
}

function MatchHistoryBadges({ history }: { history: MatchResult[] }) {
  if (history.length === 0) {
    return <span className="text-[var(--color-text-muted)]">-</span>;
  }
  
  return (
    <div className="flex gap-1 justify-start">
      {history.map((result, idx) => (
        <span
          key={idx}
          className={`
            inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold
            ${result === 'W' ? 'bg-[#4ade80] text-[#052e16]' : ''}
            ${result === 'L' ? 'bg-[#f87171] text-[#450a0a]' : ''}
            ${result === 'T' ? 'bg-[#fbbf24] text-[#451a03]' : ''}
            ${result === 'B' ? 'bg-[#60a5fa] text-[#172554]' : ''}
          `}
        >
          {result}
        </span>
      ))}
    </div>
  );
}

// Pool colors for shading rows
const POOL_COLORS = [
  { bg: 'bg-emerald-500/10', border: 'border-l-emerald-500', label: 'Pool A' },
  { bg: 'bg-blue-500/10', border: 'border-l-blue-500', label: 'Pool B' },
  { bg: 'bg-amber-500/10', border: 'border-l-amber-500', label: 'Pool C' },
  { bg: 'bg-purple-500/10', border: 'border-l-purple-500', label: 'Pool D' },
  { bg: 'bg-rose-500/10', border: 'border-l-rose-500', label: 'Pool E' },
  { bg: 'bg-cyan-500/10', border: 'border-l-cyan-500', label: 'Pool F' },
  { bg: 'bg-orange-500/10', border: 'border-l-orange-500', label: 'Pool G' },
  { bg: 'bg-indigo-500/10', border: 'border-l-indigo-500', label: 'Pool H' },
];

function getPoolForRank(rank: number, poolSize: number): number {
  return Math.floor((rank - 1) / poolSize);
}

function getPoolColor(poolIndex: number) {
  return POOL_COLORS[poolIndex % POOL_COLORS.length];
}

function getPoolLabel(poolIndex: number): string {
  return String.fromCharCode(65 + poolIndex); // A, B, C, D...
}

export function Standings() {
  const { tournament, getStandings } = useTournamentStore();

  if (!tournament) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-text-muted)]">No tournament in progress</p>
      </div>
    );
  }

  const standings = getStandings();
  const isComplete = tournament.status === 'completed';
  const poolSize = tournament.settings.poolSize || 8; // Default to 8 if not set

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">
            {isComplete ? 'Final Standings' : 'Current Standings'}
          </h2>
          <p className="text-[var(--color-text-secondary)] mt-1">
            After Round {tournament.currentRound} of {tournament.totalRounds}
          </p>
        </div>
      </div>

      {/* Main Standings Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-bg-tertiary)]">
                <th className="px-3 py-2 text-left text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  #
                </th>
                <th className="px-3 py-2 text-left text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Player
                </th>
                <th className="px-2 py-2 text-center text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  W
                </th>
                <th className="px-2 py-2 text-center text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  L
                </th>
                <th className="px-2 py-2 text-center text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  T
                </th>
                <th className="px-2 py-2 text-center text-sm font-semibold text-[var(--color-accent)] uppercase tracking-wider">
                  Score
                </th>
                <th className="px-2 py-2 text-center text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  PF
                </th>
                <th className="px-2 py-2 text-center text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  PA
                </th>
                <th className="px-2 py-2 text-center text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  +/-
                </th>
                <th className="px-2 py-2 text-center text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  20s
                </th>
                <th className="px-3 py-2 text-left text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  History
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {standings.map((standing, index) => {
                const diff = standing.player.pointsFor - standing.player.pointsAgainst;
                const isTopThree = index < 3 && isComplete;
                const poolIndex = getPoolForRank(standing.rank, poolSize);
                const poolColor = getPoolColor(poolIndex);
                
                return (
                  <tr
                    key={standing.player.id}
                    className={`
                      transition-colors border-l-4
                      ${poolColor.bg} ${poolColor.border}
                      ${isTopThree ? 'bg-[var(--color-accent)]/5' : ''}
                    `}
                  >
                    <td className="px-3 py-2">
                      <span className={`
                        inline-flex items-center justify-center w-8 h-8 rounded-full text-lg font-bold
                        ${index === 0 ? 'bg-yellow-500/20 text-yellow-400' : ''}
                        ${index === 1 ? 'bg-gray-400/20 text-gray-300' : ''}
                        ${index === 2 ? 'bg-amber-600/20 text-amber-500' : ''}
                        ${index > 2 ? 'text-[var(--color-text-muted)]' : ''}
                      `}>
                        {standing.rank}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-lg font-semibold ${isTopThree ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                        {standing.player.name}
                      </span>
                      {standing.player.byeCount > 0 && (
                        <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                          ({standing.player.byeCount}B)
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center text-lg font-mono font-bold text-[var(--color-success)]">
                      {standing.player.wins}
                    </td>
                    <td className="px-2 py-2 text-center text-lg font-mono font-bold text-[var(--color-error)]">
                      {standing.player.losses}
                    </td>
                    <td className="px-2 py-2 text-center text-lg font-mono font-bold text-[var(--color-warning)]">
                      {standing.player.ties}
                    </td>
                    <td className="px-2 py-2 text-center text-lg font-mono font-bold text-[var(--color-accent)]">
                      {standing.score}
                    </td>
                    <td className="px-2 py-2 text-center text-lg font-mono text-[var(--color-text-primary)]">
                      {standing.player.pointsFor}
                    </td>
                    <td className="px-2 py-2 text-center text-lg font-mono text-[var(--color-text-secondary)]">
                      {standing.player.pointsAgainst}
                    </td>
                    <td className="px-2 py-2 text-center text-lg font-mono font-bold">
                      <span className={diff > 0 ? 'text-[var(--color-success)]' : diff < 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-text-muted)]'}>
                        {diff > 0 ? '+' : ''}{diff}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center text-lg font-mono font-bold text-[var(--color-accent)]">
                      {standing.player.twenties}
                    </td>
                    <td className="px-3 py-2">
                      <MatchHistoryBadges history={getPlayerMatchHistory(standing.player.id, tournament.matches)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pool Legend */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-[var(--color-text-muted)]">Pools ({poolSize} players each):</span>
          {Array.from({ length: Math.ceil(standings.length / poolSize) }).map((_, i) => {
            const color = getPoolColor(i);
            const startRank = i * poolSize + 1;
            const endRank = Math.min((i + 1) * poolSize, standings.length);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded ${color.bg} border-l-2 ${color.border}`}></span>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Pool {getPoolLabel(i)} ({startRank}-{endRank})
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Column Legend */}
      <div className="flex flex-wrap gap-6 text-sm text-[var(--color-text-muted)]">
        <span>W = Wins</span>
        <span>L = Losses</span>
        <span>T = Ties</span>
        <span className="text-[var(--color-accent)]">Score = W×2 + T×1 (Bye=Win)</span>
        <span>PF = Points For</span>
        <span>PA = Points Against</span>
        <span>+/- = Differential</span>
        <span>20s = Twenties</span>
      </div>

      {/* 20s Leaderboard */}
      <TwentiesLeaderboard />
    </div>
  );
}
