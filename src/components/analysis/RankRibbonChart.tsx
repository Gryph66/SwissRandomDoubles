import { useMemo, useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';

// Vibrant colors for top 2 pools (16 players if pool size 8)
const TOP_POOL_COLORS = [
  '#10b981', // emerald - Pool A
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
];

// Muted color for lower pools
const MUTED_COLOR = '#64748b'; // slate-500

interface PlayerRankData {
  playerId: string;
  name: string;
  ranks: number[]; // rank at each round
  finalRank: number;
  poolIndex: number;
  isTopPool: boolean;
}

export function RankRibbonChart() {
  const { tournament } = useTournamentStore();
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);
  const [showAllLabels, setShowAllLabels] = useState(false);

  const chartData = useMemo(() => {
    if (!tournament || tournament.currentRound === 0) return null;

    const poolSize = tournament.settings.poolSize || 8;
    const topPoolsCutoff = poolSize * 2; // Top 2 pools
    const playerRanks: Map<string, number[]> = new Map();

    // Initialize with empty ranks
    tournament.players.forEach(p => {
      playerRanks.set(p.id, []);
    });

    // Track cumulative stats through rounds
    const playerStats: Map<string, { wins: number; ties: number; pointsFor: number; pointsAgainst: number; twenties: number }> = new Map();
    tournament.players.forEach(p => {
      playerStats.set(p.id, { wins: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, twenties: 0 });
    });

    // Process each round
    for (let round = 1; round <= tournament.currentRound; round++) {
      const roundMatches = tournament.matches.filter(m => m.round === round);

      // Update stats from this round
      roundMatches.forEach(match => {
        if (match.isBye) {
          const stats = playerStats.get(match.team1[0]);
          if (stats) {
            stats.ties += 1;
            stats.pointsFor += match.score1 ?? 4;
            stats.pointsAgainst += match.score2 ?? 4;
            stats.twenties += match.twenties1 ?? 0;
          }
        } else if (match.completed && match.score1 !== null && match.score2 !== null) {
          // Team 1
          match.team1.forEach(playerId => {
            const stats = playerStats.get(playerId);
            if (stats) {
              stats.pointsFor += match.score1!;
              stats.pointsAgainst += match.score2!;
              stats.twenties += match.twenties1 ?? 0;
              if (match.score1! > match.score2!) stats.wins += 1;
              else if (match.score1! < match.score2!) { /* loss */ }
              else stats.ties += 1;
            }
          });
          // Team 2
          match.team2?.forEach(playerId => {
            const stats = playerStats.get(playerId);
            if (stats) {
              stats.pointsFor += match.score2!;
              stats.pointsAgainst += match.score1!;
              stats.twenties += match.twenties2 ?? 0;
              if (match.score2! > match.score1!) stats.wins += 1;
              else if (match.score2! < match.score1!) { /* loss */ }
              else stats.ties += 1;
            }
          });
        }
      });

      // Calculate rankings after this round
      const rankings = tournament.players
        .filter(p => p.active)
        .map(p => {
          const stats = playerStats.get(p.id)!;
          const score = (stats.wins * 2) + (stats.ties * 1);
          return { id: p.id, score, ...stats };
        })
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
          if (a.pointsAgainst !== b.pointsAgainst) return a.pointsAgainst - b.pointsAgainst;
          return b.twenties - a.twenties;
        });

      // Assign ranks
      rankings.forEach((p, idx) => {
        const ranks = playerRanks.get(p.id);
        if (ranks) ranks.push(idx + 1);
      });
    }

    // Build final data
    const data: PlayerRankData[] = [];
    tournament.players.filter(p => p.active).forEach(player => {
      const ranks = playerRanks.get(player.id) || [];
      if (ranks.length > 0) {
        const finalRank = ranks[ranks.length - 1];
        data.push({
          playerId: player.id,
          name: player.name,
          ranks,
          finalRank,
          poolIndex: Math.floor((finalRank - 1) / poolSize),
          isTopPool: finalRank <= topPoolsCutoff,
        });
      }
    });

    // Sort by final rank
    data.sort((a, b) => a.finalRank - b.finalRank);

    return {
      players: data,
      rounds: tournament.currentRound,
      poolSize,
      topPoolsCutoff,
    };
  }, [tournament]);

  if (!chartData || chartData.rounds === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-text-muted)]">
        No ranking data available yet
      </div>
    );
  }

  const { players, rounds, topPoolsCutoff } = chartData;
  const numPlayers = players.length;

  // Chart dimensions
  const margin = { top: 40, right: 120, bottom: 20, left: 120 };
  const width = 800;
  const rowHeight = Math.max(20, Math.min(32, 600 / numPlayers));
  const height = margin.top + margin.bottom + (numPlayers * rowHeight);
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Scale functions
  const xScale = (round: number) => margin.left + ((round - 1) / Math.max(1, rounds - 1)) * chartWidth;
  const yScale = (rank: number) => margin.top + ((rank - 1) / Math.max(1, numPlayers - 1)) * chartHeight;

  // Generate smooth path for a player's ribbon
  const generatePath = (ranks: number[]) => {
    if (ranks.length === 0) return '';
    if (ranks.length === 1) {
      const x = xScale(1);
      const y = yScale(ranks[0]);
      return `M ${x} ${y} L ${x + 10} ${y}`;
    }

    let path = `M ${xScale(1)} ${yScale(ranks[0])}`;

    for (let i = 1; i < ranks.length; i++) {
      const x0 = xScale(i);
      const y0 = yScale(ranks[i - 1]);
      const x1 = xScale(i + 1);
      const y1 = yScale(ranks[i]);

      // Bezier curve control points
      const cx = (x0 + x1) / 2;
      path += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }

    return path;
  };

  // Get color for a player based on final rank
  const getPlayerColor = (player: PlayerRankData) => {
    if (player.isTopPool) {
      // Use rank-1 as index into top pool colors (wrapping if needed)
      return TOP_POOL_COLORS[(player.finalRank - 1) % TOP_POOL_COLORS.length];
    }
    return MUTED_COLOR;
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-[var(--color-text-muted)]">
          Hover over a ribbon to highlight a player's journey
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={showAllLabels}
            onChange={(e) => setShowAllLabels(e.target.checked)}
            className="rounded"
          />
          Show all names
        </label>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[600px]"
        style={{ maxHeight: '70vh' }}
      >
        {/* Background */}
        <rect x={0} y={0} width={width} height={height} fill="transparent" />

        {/* Round labels at top */}
        {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
          <text
            key={round}
            x={xScale(round)}
            y={margin.top - 15}
            textAnchor="middle"
            className="fill-[var(--color-text-muted)] text-xs font-medium"
          >
            R{round}
          </text>
        ))}

        {/* Vertical grid lines for rounds */}
        {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
          <line
            key={round}
            x1={xScale(round)}
            y1={margin.top - 5}
            x2={xScale(round)}
            y2={height - margin.bottom}
            stroke="var(--color-border)"
            strokeWidth={1}
            strokeDasharray="4,4"
            opacity={0.3}
          />
        ))}

        {/* Ribbons - draw non-hovered first, then hovered on top */}
        {players
          .filter(p => p.playerId !== hoveredPlayer)
          .map((player) => (
            <g key={player.playerId}>
              <path
                d={generatePath(player.ranks)}
                fill="none"
                stroke={getPlayerColor(player)}
                strokeWidth={hoveredPlayer ? 2 : 3.5}
                strokeLinecap="round"
                opacity={hoveredPlayer ? 0.15 : (player.isTopPool ? 0.7 : 0.4)}
                className="transition-all duration-200"
              />
              {/* Invisible wider path for hover detection */}
              <path
                d={generatePath(player.ranks)}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                strokeLinecap="round"
                onMouseEnter={() => setHoveredPlayer(player.playerId)}
                onMouseLeave={() => setHoveredPlayer(null)}
                className="cursor-pointer"
              />
            </g>
          ))}

        {/* Hovered player on top */}
        {hoveredPlayer && players
          .filter(p => p.playerId === hoveredPlayer)
          .map((player) => (
            <g key={player.playerId}>
              <path
                d={generatePath(player.ranks)}
                fill="none"
                stroke={getPlayerColor(player)}
                strokeWidth={5}
                strokeLinecap="round"
                opacity={1}
                className="transition-all duration-200"
              />
              {/* Rank dots */}
              {player.ranks.map((rank, idx) => (
                <circle
                  key={idx}
                  cx={xScale(idx + 1)}
                  cy={yScale(rank)}
                  r={6}
                  fill={getPlayerColor(player)}
                  stroke="var(--color-bg-primary)"
                  strokeWidth={2}
                />
              ))}
              {/* Invisible wider path for hover detection */}
              <path
                d={generatePath(player.ranks)}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                strokeLinecap="round"
                onMouseEnter={() => setHoveredPlayer(player.playerId)}
                onMouseLeave={() => setHoveredPlayer(null)}
                className="cursor-pointer"
              />
            </g>
          ))}

        {/* Player name labels on left (starting position) */}
        {players.map((player) => {
          const startRank = player.ranks[0];
          const isHovered = player.playerId === hoveredPlayer;
          // Show labels for top 2 pools, hovered, or if show all is enabled
          const showLabel = showAllLabels || isHovered || player.isTopPool;

          return (
            <g key={`label-left-${player.playerId}`}>
              {showLabel && (
                <text
                  x={margin.left - 8}
                  y={yScale(startRank)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className={`transition-all duration-200 ${
                    isHovered 
                      ? 'fill-[var(--color-text-primary)] font-bold' 
                      : player.isTopPool
                        ? 'fill-[var(--color-text-secondary)]'
                        : 'fill-[var(--color-text-muted)]'
                  }`}
                  style={{ fontSize: isHovered ? '12px' : '10px' }}
                >
                  {player.name}
                </text>
              )}
              {/* Start rank indicator for hidden labels */}
              {!showLabel && (
                <circle
                  cx={margin.left - 3}
                  cy={yScale(startRank)}
                  r={3}
                  fill={getPlayerColor(player)}
                  opacity={0.4}
                />
              )}
            </g>
          );
        })}

        {/* Player name labels on right (final position) */}
        {players.map((player) => {
          const endRank = player.ranks[player.ranks.length - 1];
          const isHovered = player.playerId === hoveredPlayer;
          const showLabel = showAllLabels || isHovered || player.isTopPool;

          return (
            <g key={`label-right-${player.playerId}`}>
              {showLabel && (
                <text
                  x={width - margin.right + 8}
                  y={yScale(endRank)}
                  textAnchor="start"
                  dominantBaseline="middle"
                  className={`transition-all duration-200 ${
                    isHovered 
                      ? 'fill-[var(--color-text-primary)] font-bold' 
                      : player.isTopPool
                        ? 'fill-[var(--color-text-secondary)]'
                        : 'fill-[var(--color-text-muted)]'
                  }`}
                  style={{ fontSize: isHovered ? '12px' : '10px' }}
                >
                  #{endRank} {player.name}
                </text>
              )}
              {/* End rank dot for hidden labels */}
              {!showLabel && (
                <circle
                  cx={width - margin.right + 3}
                  cy={yScale(endRank)}
                  r={3}
                  fill={getPlayerColor(player)}
                  opacity={0.4}
                />
              )}
            </g>
          );
        })}

        {/* Hovered player info tooltip */}
        {hoveredPlayer && (() => {
          const player = players.find(p => p.playerId === hoveredPlayer);
          if (!player) return null;
          
          const movement = player.ranks[0] - player.finalRank;
          const arrow = movement > 0 ? '↑' : movement < 0 ? '↓' : '→';
          
          return (
            <g>
              <rect
                x={width / 2 - 110}
                y={5}
                width={220}
                height={28}
                rx={4}
                fill="var(--color-bg-tertiary)"
                stroke={getPlayerColor(player)}
                strokeWidth={2}
              />
              <text
                x={width / 2}
                y={23}
                textAnchor="middle"
                className="fill-[var(--color-text-primary)] text-sm font-semibold"
              >
                {player.name}: #{player.ranks[0]} → #{player.finalRank} {arrow}
                {movement !== 0 && ` (${movement > 0 ? '+' : ''}${movement})`}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {TOP_POOL_COLORS.slice(0, 6).map((color, i) => (
              <div
                key={i}
                className="w-2 h-3 rounded-sm"
                style={{ backgroundColor: color, opacity: 0.8 }}
              />
            ))}
          </div>
          <span className="text-[var(--color-text-muted)]">Top {topPoolsCutoff} (Pools A-B)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-3 rounded-sm"
            style={{ backgroundColor: MUTED_COLOR, opacity: 0.5 }}
          />
          <span className="text-[var(--color-text-muted)]">Others</span>
        </div>
      </div>
    </div>
  );
}
