import { useState } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import type { BracketType, PoolBracketConfig } from '../../types';

interface Pool {
    id: string;
    name: string;
    players: { id: string; name: string; rank: number }[];
}

export function FinalsConfig() {
    const { tournament, configureFinalsMode, generateBrackets } = useTournamentStore();
    const [poolConfigs, setPoolConfigs] = useState<Map<string, { bracketType: BracketType; includeThirdPlace: boolean }>>(new Map());

    if (!tournament || !tournament.settings.finalsEnabled) {
        return null;
    }

    // Get standings and create pools
    const standings = useTournamentStore.getState().getStandings();
    const poolSize = tournament.settings.poolSize;

    // Create pools from standings
    const pools: Pool[] = [];
    const poolNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    for (let i = 0; i < standings.length; i += poolSize) {
        const poolPlayers = standings.slice(i, i + poolSize);
        const poolIndex = Math.floor(i / poolSize);

        pools.push({
            id: `pool-${poolIndex}`,
            name: `Pool ${poolNames[poolIndex]}`,
            players: poolPlayers.map(s => ({
                id: s.player.id,
                name: s.player.name,
                rank: s.rank,
            })),
        });
    }

    // Initialize pool configs if not set
    pools.forEach(pool => {
        if (!poolConfigs.has(pool.id)) {
            setPoolConfigs(prev => new Map(prev).set(pool.id, {
                bracketType: pool.players.length >= 8 ? 'quarterfinals' : pool.players.length >= 4 ? 'semifinals' : 'none',
                includeThirdPlace: false,
            }));
        }
    });

    const handleBracketTypeChange = (poolId: string, bracketType: BracketType) => {
        setPoolConfigs(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(poolId) || { bracketType: 'none', includeThirdPlace: false };
            newMap.set(poolId, { ...current, bracketType });
            return newMap;
        });
    };

    const handleThirdPlaceChange = (poolId: string, includeThirdPlace: boolean) => {
        setPoolConfigs(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(poolId) || { bracketType: 'none', includeThirdPlace: false };
            newMap.set(poolId, { ...current, includeThirdPlace });
            return newMap;
        });
    };

    const handleGenerateBrackets = () => {
        const configs: PoolBracketConfig[] = pools.map(pool => {
            const config = poolConfigs.get(pool.id) || { bracketType: 'none', includeThirdPlace: false };
            return {
                poolId: pool.id,
                poolName: pool.name,
                bracketType: config.bracketType,
                playerIds: pool.players.map(p => p.id),
                includeThirdPlace: config.includeThirdPlace,
            };
        });

        configureFinalsMode(configs);
        generateBrackets();
    };

    const canGenerate = pools.some(pool => {
        const config = poolConfigs.get(pool.id);
        return config && config.bracketType !== 'none';
    });

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div className="card p-6">
                <h1 className="text-2xl font-display font-bold mb-2">Configure Finals Brackets</h1>
                <p className="text-[var(--color-text-secondary)]">
                    Swiss rounds are complete! Configure playoff brackets for each pool below.
                </p>
            </div>

            {pools.map(pool => {
                const config = poolConfigs.get(pool.id) || { bracketType: 'none', includeThirdPlace: false };
                const playerCount = pool.players.length;

                return (
                    <div key={pool.id} className="card p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-display font-semibold">{pool.name}</h2>
                                <p className="text-sm text-[var(--color-text-muted)]">
                                    {playerCount} players (Ranks {pool.players[0]?.rank} - {pool.players[pool.players.length - 1]?.rank})
                                </p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="label text-sm">Bracket Type</label>
                                <select
                                    value={config.bracketType}
                                    onChange={(e) => handleBracketTypeChange(pool.id, e.target.value as BracketType)}
                                    className="input w-48"
                                >
                                    <option value="none">No Bracket</option>
                                    {playerCount >= 4 && <option value="final">Final Only (Top 4)</option>}
                                    {playerCount >= 4 && <option value="semifinals">Semifinals + Final</option>}
                                    {playerCount >= 8 && <option value="quarterfinals">Quarterfinals + Semis + Final</option>}
                                </select>
                            </div>
                        </div>

                        {/* Player List */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                            {pool.players.map((player) => (
                                <div
                                    key={player.id}
                                    className="flex items-center gap-2 p-2 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]"
                                >
                                    <span className="text-xs font-medium text-[var(--color-text-muted)] w-6">#{player.rank}</span>
                                    <span className="text-sm truncate">{player.name}</span>
                                </div>
                            ))}
                        </div>

                        {/* 3rd Place Match Option */}
                        {(config.bracketType === 'semifinals' || config.bracketType === 'quarterfinals') && (
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.includeThirdPlace}
                                    onChange={(e) => handleThirdPlaceChange(pool.id, e.target.checked)}
                                    className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-tertiary)] 
                           text-[var(--color-accent)] focus:ring-[var(--color-accent)] focus:ring-offset-0"
                                />
                                <span className="text-sm text-[var(--color-text-secondary)]">
                                    Include 3rd place match
                                </span>
                            </label>
                        )}

                        {/* Bracket Preview */}
                        {config.bracketType !== 'none' && (
                            <div className="mt-4 p-3 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-accent)]/20">
                                <p className="text-xs font-medium text-[var(--color-accent)] mb-2">Bracket Preview:</p>
                                <p className="text-sm text-[var(--color-text-secondary)]">
                                    {config.bracketType === 'final' && '1 match: Top 4 players compete (1v2 vs 3v4)'}
                                    {config.bracketType === 'semifinals' && `${config.includeThirdPlace ? '3' : '2'} matches: 2 semifinals → 1 final${config.includeThirdPlace ? ' + 3rd place' : ''}`}
                                    {config.bracketType === 'quarterfinals' && `${config.includeThirdPlace ? '7' : '6'} matches: 4 quarters → 2 semis → 1 final${config.includeThirdPlace ? ' + 3rd place' : ''}`}
                                </p>
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                    Default seeding: Traditional (1v4, 2v3 for semis)
                                </p>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Generate Button */}
            <div className="card p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-display font-semibold">Ready to Generate Brackets?</h3>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                            {canGenerate
                                ? 'Brackets will be created based on your configuration above'
                                : 'Select at least one bracket type to continue'
                            }
                        </p>
                    </div>
                    <button
                        onClick={handleGenerateBrackets}
                        disabled={!canGenerate}
                        className={`btn ${canGenerate ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'}`}
                    >
                        Generate Brackets
                    </button>
                </div>
            </div>
        </div>
    );
}
