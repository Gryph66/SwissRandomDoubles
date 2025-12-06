import { useMemo } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import type { Player, Match } from '../../types';

interface RoundSnapshot {
  round: number;
  rankings: PlayerRoundData[];
}

interface PlayerRoundData {
  player: Player;
  rank: number;
  wins: number;
  pointDiff: number;
  partnerId: string | null;
  partnerRank: number | null;
  wasWinner: boolean | null;
  hadBye: boolean;
}

export function SwissAnalysis() {
  const { tournament, getPlayerById } = useTournamentStore();

  const analysis = useMemo(() => {
    if (!tournament || tournament.currentRound === 0) return null;

    const snapshots: RoundSnapshot[] = [];
    const playerStats: Map<string, { wins: number; pointsFor: number; pointsAgainst: number }> = new Map();

    // Initialize player stats
    tournament.players.forEach((p) => {
      playerStats.set(p.id, { wins: 0, pointsFor: 0, pointsAgainst: 0 });
    });

    // Process each round
    for (let round = 1; round <= tournament.currentRound; round++) {
      const roundMatches = tournament.matches.filter((m) => m.round === round);
      
      // Update stats from this round's matches
      roundMatches.forEach((match) => {
        if (match.isBye) {
          const stats = playerStats.get(match.team1[0]);
          if (stats) {
            stats.wins += 1;
            stats.pointsFor += 4;
          }
        } else if (match.completed && match.score1 !== null && match.score2 !== null) {
          // Team 1
          match.team1.forEach((playerId) => {
            const stats = playerStats.get(playerId);
            if (stats) {
              stats.pointsFor += match.score1!;
              stats.pointsAgainst += match.score2!;
              if (match.score1! > match.score2!) stats.wins += 1;
            }
          });
          // Team 2
          match.team2?.forEach((playerId) => {
            const stats = playerStats.get(playerId);
            if (stats) {
              stats.pointsFor += match.score2!;
              stats.pointsAgainst += match.score1!;
              if (match.score2! > match.score1!) stats.wins += 1;
            }
          });
        }
      });

      // Calculate rankings after this round
      const rankings: PlayerRoundData[] = tournament.players
        .filter((p) => p.active)
        .map((player) => {
          const stats = playerStats.get(player.id)!;
          const match = roundMatches.find(
            (m) => m.team1.includes(player.id) || m.team2?.includes(player.id)
          );

          let partnerId: string | null = null;
          let wasWinner: boolean | null = null;
          let hadBye = false;

          if (match) {
            if (match.isBye) {
              hadBye = true;
              wasWinner = true;
            } else {
              const inTeam1 = match.team1.includes(player.id);
              if (inTeam1) {
                partnerId = match.team1.find((id) => id !== player.id) ?? null;
                if (match.score1 !== null && match.score2 !== null) {
                  wasWinner = match.score1 > match.score2 ? true : match.score1 < match.score2 ? false : null;
                }
              } else {
                partnerId = match.team2?.find((id) => id !== player.id) ?? null;
                if (match.score1 !== null && match.score2 !== null) {
                  wasWinner = match.score2 > match.score1 ? true : match.score2 < match.score1 ? false : null;
                }
              }
            }
          }

          return {
            player,
            rank: 0,
            wins: stats.wins,
            pointDiff: stats.pointsFor - stats.pointsAgainst,
            partnerId,
            partnerRank: null,
            wasWinner,
            hadBye,
          };
        })
        .sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.pointDiff - a.pointDiff;
        });

      // Assign ranks
      rankings.forEach((r, idx) => {
        r.rank = idx + 1;
      });

      // Calculate partner ranks
      rankings.forEach((r) => {
        if (r.partnerId) {
          const partnerData = rankings.find((pr) => pr.player.id === r.partnerId);
          r.partnerRank = partnerData?.rank ?? null;
        }
      });

      snapshots.push({ round, rankings: [...rankings] });
    }

    return snapshots;
  }, [tournament]);

  if (!tournament || !analysis || analysis.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-text-muted)]">No tournament data to analyze</p>
      </div>
    );
  }

  const finalRanking = analysis[analysis.length - 1].rankings;
  const poolSize = tournament.settings.poolSize || 8; // Default to 8 if not set
  const numPools = Math.ceil(finalRanking.length / poolSize);

  // Pool colors matching Standings page
  const POOL_COLORS = [
    { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
    { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400' },
    { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400' },
    { bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400' },
    { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400' },
    { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' },
    { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400' },
  ];

  const getPoolForRank = (rank: number) => Math.floor((rank - 1) / poolSize);
  const getPoolColor = (poolIndex: number) => POOL_COLORS[poolIndex % POOL_COLORS.length];
  const getPoolLabel = (poolIndex: number) => String.fromCharCode(65 + poolIndex);

  // Calculate rank changes for each player
  const getRankHistory = (playerId: string) => {
    return analysis.map((snapshot) => {
      const playerData = snapshot.rankings.find((r) => r.player.id === playerId);
      return playerData?.rank ?? null;
    });
  };

  // Get pool color based on rank
  const getPoolColorForRank = (rank: number) => {
    const poolIndex = getPoolForRank(rank);
    const color = getPoolColor(poolIndex);
    return `${color.bg} ${color.text} ${color.border}`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-display font-bold">Swiss Analysis</h2>
        <p className="text-[var(--color-text-secondary)] mt-1">
          See how the Swiss system separates players by skill over {analysis.length} rounds
        </p>
      </div>

      {/* Pool Separation */}
      <section className="card p-6">
        <h3 className="text-xl font-display font-semibold mb-4">Pool Separation</h3>
        <p className="text-base text-[var(--color-text-muted)] mb-6">
          Players are grouped into pools of {poolSize} based on their final ranking. 
          The Swiss format pairs similar-ranked players as partners, causing skill levels to naturally separate.
        </p>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: Math.min(numPools, 8) }).map((_, poolIdx) => {
            const color = getPoolColor(poolIdx);
            const startRank = poolIdx * poolSize + 1;
            const endRank = Math.min((poolIdx + 1) * poolSize, finalRanking.length);
            const poolPlayers = finalRanking.filter((r) => getPoolForRank(r.rank) === poolIdx);

            return (
              <div key={poolIdx} className={`p-5 rounded-lg border ${color.bg} ${color.border}`}>
                <div className={`text-xl font-bold ${color.text}`}>Pool {getPoolLabel(poolIdx)}</div>
                <div className="text-base text-[var(--color-text-muted)] mb-3">({startRank}-{endRank})</div>
                <div className="space-y-1">
                  {poolPlayers.map((r) => (
                    <div key={r.player.id} className="text-lg font-medium text-[var(--color-text-primary)]">
                      {r.rank}. {r.player.name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {numPools > 8 && (
          <p className="text-base text-[var(--color-text-muted)] mt-4">
            + {numPools - 8} more pools not shown
          </p>
        )}
      </section>

      {/* Rank Progression Table */}
      <section className="card p-6">
        <h3 className="text-lg font-display font-semibold mb-4">Rank Progression</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Track how each player's ranking changed after each round. 
          Partners are shown with their rank at the time of pairing.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-2 px-3 font-semibold text-[var(--color-text-muted)]">Player</th>
                <th className="text-center py-2 px-3 font-semibold text-[var(--color-text-muted)]">Final</th>
                {analysis.map((snapshot) => (
                  <th key={snapshot.round} className="text-center py-2 px-3 font-semibold text-[var(--color-text-muted)]">
                    R{snapshot.round}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {finalRanking.map((playerData) => {
                const history = getRankHistory(playerData.player.id);

                return (
                  <tr key={playerData.player.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-tertiary)]">
                    <td className="py-2 px-3">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {playerData.player.name}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold border ${getPoolColorForRank(playerData.rank)}`}>
                        {playerData.rank}
                      </span>
                    </td>
                    {analysis.map((snapshot, roundIdx) => {
                      const roundData = snapshot.rankings.find((r) => r.player.id === playerData.player.id);
                      if (!roundData) return <td key={snapshot.round} className="py-2 px-3 text-center">-</td>;

                      const prevRank = roundIdx > 0 ? history[roundIdx - 1] : null;
                      const rankChange = prevRank ? prevRank - roundData.rank : 0;

                      return (
                        <td key={snapshot.round} className="py-2 px-3">
                          <div className="flex flex-col items-center gap-0.5">
                            {/* Rank with result indicator */}
                            <div className="flex items-center gap-1">
                              <span className={`
                                inline-flex items-center justify-center w-6 h-5 rounded text-xs font-mono
                                ${roundData.wasWinner === true ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]' : ''}
                                ${roundData.wasWinner === false ? 'bg-[var(--color-error)]/20 text-[var(--color-error)]' : ''}
                                ${roundData.wasWinner === null ? 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]' : ''}
                                ${roundData.hadBye ? 'bg-blue-500/20 text-blue-400' : ''}
                              `}>
                                {roundData.rank}
                              </span>
                              {rankChange !== 0 && (
                                <span className={`text-[10px] ${rankChange > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                                  {rankChange > 0 ? `+${rankChange}` : rankChange}
                                </span>
                              )}
                            </div>
                            {/* Partner info */}
                            {roundData.partnerId && (
                              <div className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[80px]">
                                w/ #{roundData.partnerRank} {getPlayerById(roundData.partnerId)?.name?.split(' ')[0]}
                              </div>
                            )}
                            {roundData.hadBye && (
                              <div className="text-[10px] text-blue-400">bye</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Partner Pairing Analysis */}
      <section className="card p-6">
        <h3 className="text-lg font-display font-semibold mb-4">Partner Pairing Quality</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Shows the average rank difference between partners each round. 
          Lower numbers mean players are being paired with others of similar skill.
        </p>
        <div className="flex gap-4">
          {analysis.map((snapshot) => {
            // Calculate average rank difference between partners
            const pairDiffs: number[] = [];
            const seen = new Set<string>();
            
            snapshot.rankings.forEach((r) => {
              if (r.partnerId && !seen.has(r.player.id) && !seen.has(r.partnerId)) {
                const partnerData = snapshot.rankings.find((pr) => pr.player.id === r.partnerId);
                if (partnerData) {
                  pairDiffs.push(Math.abs(r.rank - partnerData.rank));
                  seen.add(r.player.id);
                  seen.add(r.partnerId);
                }
              }
            });

            const avgDiff = pairDiffs.length > 0 
              ? (pairDiffs.reduce((a, b) => a + b, 0) / pairDiffs.length).toFixed(1)
              : '-';

            return (
              <div key={snapshot.round} className="flex-1 text-center p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Round {snapshot.round}</div>
                <div className={`text-2xl font-mono font-bold ${
                  snapshot.round === 1 ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-accent)]'
                }`}>
                  {avgDiff}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">avg rank diff</div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          Round 1 is random. Subsequent rounds should show lower numbers as similar-skilled players get paired together.
        </p>
      </section>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-[var(--color-success)]/20"></span>
          <span>Won</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-[var(--color-error)]/20"></span>
          <span>Lost</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-[var(--color-warning)]/20"></span>
          <span>Tied</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-blue-500/20"></span>
          <span>Bye</span>
        </div>
      </div>
    </div>
  );
}
