import { useState, useEffect } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import type { BracketType, PoolBracketConfig } from '../../types';

interface Pool {
    id: string;
    name: string;
    players: { id: string; name: string; rank: number }[];
}

interface PoolConfig {
    bracketType: BracketType;
    includeThirdPlace: boolean;
    selectedPlayerIds?: string[]; // Manual player selection
    showCustomize: boolean;
    pairingMode: 'auto' | 'manual';
    manualTeams?: [string, string][]; // Custom teams defined by player IDs
}

export function FinalsConfig() {
    const { tournament, generateFinals } = useTournamentStore();
    const [poolConfigs, setPoolConfigs] = useState<Map<string, PoolConfig>>(new Map());

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

    const getRequiredPlayerCount = (bracketType: BracketType): number => {
        switch (bracketType) {
            case 'final': return 4;
            case 'semifinals': return 8;
            case 'quarterfinals': return 16;
            default: return 0;
        }
    };

    // Initialize pool configs from existing settings or defaults
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (isInitialized) return;

        setPoolConfigs(prev => {
            const newMap = new Map(prev);

            pools.forEach(pool => {
                // Try to find existing config
                const existing = tournament?.finalsConfig?.poolConfigs.find(c => c.poolId === pool.id);

                if (existing) {
                    newMap.set(pool.id, {
                        bracketType: existing.bracketType,
                        includeThirdPlace: existing.includeThirdPlace,
                        selectedPlayerIds: existing.playerIds,
                        showCustomize: !!existing.manualTeams || existing.playerIds.length !== getRequiredPlayerCount(existing.bracketType),
                        pairingMode: existing.manualTeams ? 'manual' : 'auto',
                        manualTeams: existing.manualTeams
                    });
                } else if (!newMap.has(pool.id)) {
                    // Default
                    newMap.set(pool.id, {
                        bracketType: pool.players.length >= 16 ? 'quarterfinals' : pool.players.length >= 8 ? 'semifinals' : 'none',
                        includeThirdPlace: false,
                        showCustomize: false,
                        pairingMode: 'auto',
                        manualTeams: []
                    });
                }
            });

            return newMap;
        });

        setIsInitialized(true);
    }, [tournament, pools, isInitialized]);

    const handleBracketTypeChange = (poolId: string, bracketType: BracketType) => {
        setPoolConfigs(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(poolId)!;
            newMap.set(poolId, { ...current, bracketType });
            return newMap;
        });
    };

    const handleThirdPlaceChange = (poolId: string, includeThirdPlace: boolean) => {
        setPoolConfigs(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(poolId)!;
            newMap.set(poolId, { ...current, includeThirdPlace });
            return newMap;
        });
    };

    const toggleCustomize = (poolId: string) => {
        setPoolConfigs(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(poolId)!;
            newMap.set(poolId, { ...current, showCustomize: !current.showCustomize });
            return newMap;
        });
    };

    const togglePlayerSelection = (poolId: string, playerId: string, pool: Pool) => {
        setPoolConfigs(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(poolId)!;
            const requiredCount = getRequiredPlayerCount(current.bracketType);
            const currentSelected = current.selectedPlayerIds || pool.players.slice(0, requiredCount).map(p => p.id);

            const newSelected = currentSelected.includes(playerId)
                ? currentSelected.filter(id => id !== playerId)
                : [...currentSelected, playerId];

            newMap.set(poolId, { ...current, selectedPlayerIds: newSelected });
            return newMap;
        });
    };

    const handlePairingModeChange = (poolId: string, mode: 'auto' | 'manual') => {
        setPoolConfigs(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(poolId)!;
            // logic to init manualTeams if needed?
            let manualTeams = current.manualTeams || [];
            if (mode === 'manual' && manualTeams.length === 0) {
                const requiredCount = getRequiredPlayerCount(current.bracketType);
                const numTeams = requiredCount / 2;
                manualTeams = Array(numTeams).fill(['', '']);
            }

            newMap.set(poolId, { ...current, pairingMode: mode, manualTeams });
            return newMap;
        });
    };

    const updateManualTeam = (poolId: string, teamIndex: number, playerIndex: number, playerId: string) => {
        setPoolConfigs(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(poolId)!;
            const newTeams = [...(current.manualTeams || [])];

            // Ensure team tuple exists
            if (!newTeams[teamIndex]) newTeams[teamIndex] = ['', ''];

            // Create specific update
            const oldTeam = newTeams[teamIndex];
            const updatedTeam: [string, string] = [oldTeam[0], oldTeam[1]];
            updatedTeam[playerIndex] = playerId;

            newTeams[teamIndex] = updatedTeam;
            newMap.set(poolId, { ...current, manualTeams: newTeams });
            return newMap;
        });
    };

    const handleGenerateBrackets = () => {
        const configs: PoolBracketConfig[] = pools.map(pool => {
            const config = poolConfigs.get(pool.id)!;
            const requiredCount = getRequiredPlayerCount(config.bracketType);
            const playerIds = config.selectedPlayerIds && config.selectedPlayerIds.length === requiredCount
                ? config.selectedPlayerIds
                : pool.players.slice(0, requiredCount).map(p => p.id);

            return {
                poolId: pool.id,
                poolName: pool.name,
                bracketType: config.bracketType,
                playerIds,
                includeThirdPlace: config.includeThirdPlace,
                manualTeams: config.pairingMode === 'manual' ? config.manualTeams : undefined,
            };
        });

        generateFinals(configs);
    };

    const canGenerate = pools.some(pool => {
        const config = poolConfigs.get(pool.id);
        return config && config.bracketType !== 'none';
    });

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div className="card p-6">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl font-display font-bold">Configure Finals Brackets</h1>
                    <button
                        onClick={() => {
                            if (window.confirm('Are you sure? This will reset all current pool configurations and manual teams to defaults based on current standings.')) {
                                setPoolConfigs(new Map());
                                setIsInitialized(false);
                            }
                        }}
                        className="text-xs text-[var(--color-error)] hover:underline"
                    >
                        Reset / Recalculate Pools
                    </button>
                </div>
                <p className="text-[var(--color-text-secondary)]">
                    Swiss rounds are complete! Configure playoff brackets for each pool below.
                </p>
                {tournament?.bracketMatches && tournament.bracketMatches.length > 0 && (
                    <div className="mt-4 p-4 rounded bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                        <span className="text-xl">⚠️</span>
                        <div>
                            <p className="font-bold text-red-400">Warning: Brackets are already active</p>
                            <p className="text-sm text-red-300/80">
                                Generating brackets again will <strong>permanently delete</strong> all existing matches and scores.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {pools.map(pool => {
                const config = poolConfigs.get(pool.id) || { bracketType: 'none', includeThirdPlace: false, showCustomize: false, pairingMode: 'auto' } as PoolConfig;
                const playerCount = pool.players.length;
                const requiredCount = getRequiredPlayerCount(config.bracketType);
                const selectedIds = config.selectedPlayerIds || pool.players.slice(0, requiredCount).map(p => p.id);

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
                                    {playerCount >= 8 && <option value="semifinals">Semifinals + Final (Top 8)</option>}
                                    {playerCount >= 16 && <option value="quarterfinals">Quarterfinals + Semis + Final (Top 16)</option>}
                                </select>
                            </div>
                        </div>

                        {/* Configuration Area */}
                        {config.bracketType !== 'none' && (
                            <>
                                <div className="mb-4 flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                                    <div className="flex gap-4">
                                        {config.showCustomize && (
                                            <div className="flex gap-2 text-sm bg-[var(--color-bg-tertiary)] p-1 rounded">
                                                <button
                                                    onClick={() => handlePairingModeChange(pool.id, 'auto')}
                                                    className={`px-3 py-1 rounded transition-colors ${config.pairingMode === 'auto' ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-white/10'}`}
                                                >
                                                    Auto (High-Low)
                                                </button>
                                                <button
                                                    onClick={() => handlePairingModeChange(pool.id, 'manual')}
                                                    className={`px-3 py-1 rounded transition-colors ${config.pairingMode === 'manual' ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-white/10'}`}
                                                >
                                                    Manual Pairing
                                                </button>
                                            </div>
                                        )}
                                        {!config.showCustomize && (
                                            <p className="text-sm text-[var(--color-text-muted)] self-center">
                                                Default: High-Low Seeding (1v4, 2v3)
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => toggleCustomize(pool.id)}
                                        className="text-xs text-[var(--color-accent)] hover:underline"
                                    >
                                        {config.showCustomize ? 'Hide Customization' : 'Customize Selection'}
                                    </button>
                                </div>

                                {/* AUTO MODE: Select Players */}
                                {(!config.showCustomize || config.pairingMode === 'auto') && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                                        {pool.players.map((player) => {
                                            const isSelected = selectedIds.includes(player.id);
                                            const isInDefaultRange = pool.players.slice(0, requiredCount).some(p => p.id === player.id);

                                            return (
                                                <div
                                                    key={player.id}
                                                    onClick={() => config.showCustomize && togglePlayerSelection(pool.id, player.id, pool)}
                                                    className={`flex items-center gap-2 p-2 rounded border transition-all ${config.showCustomize ? 'cursor-pointer' : ''
                                                        } ${isSelected
                                                            ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]'
                                                            : isInDefaultRange && !config.showCustomize
                                                                ? 'bg-[var(--color-bg-tertiary)] border-[var(--color-accent)]/30'
                                                                : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] opacity-50'
                                                        }`}
                                                >
                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isSelected ? 'bg-[var(--color-accent)] text-white' : 'bg-gray-700'
                                                        }`}>
                                                        {player.rank}
                                                    </div>
                                                    <div className="truncate text-sm font-medium">{player.name}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* MANUAL MODE: Configure Teams */}
                                {config.showCustomize && config.pairingMode === 'manual' && (
                                    <div className="space-y-3 mb-6 bg-[var(--color-bg-tertiary)] p-4 rounded border border-[var(--color-border)]">
                                        <p className="text-sm text-[var(--color-text-muted)] mb-2">
                                            Define {requiredCount / 2} teams. This overrides standard ranking logic.
                                        </p>
                                        {config.manualTeams?.map((team, idx) => (
                                            <div key={idx} className="flex gap-4 items-center">
                                                <span className="w-16 text-sm font-mono text-[var(--color-text-muted)]">Seed {idx + 1}</span>
                                                <select
                                                    value={team[0]}
                                                    onChange={(e) => updateManualTeam(pool.id, idx, 0, e.target.value)}
                                                    className="input text-sm flex-1"
                                                >
                                                    <option value="">Select Player...</option>
                                                    {pool.players.map(p => (
                                                        <option key={p.id} value={p.id}>{p.rank}. {p.name}</option>
                                                    ))}
                                                </select>
                                                <span className="text-[var(--color-text-muted)]">&</span>
                                                <select
                                                    value={team[1]}
                                                    onChange={(e) => updateManualTeam(pool.id, idx, 1, e.target.value)}
                                                    className="input text-sm flex-1"
                                                >
                                                    <option value="">Select Player...</option>
                                                    {pool.players.map(p => (
                                                        <option key={p.id} value={p.id}>{p.rank}. {p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        id={`third-${pool.id}`}
                                        checked={config.includeThirdPlace}
                                        onChange={(e) => handleThirdPlaceChange(pool.id, e.target.checked)}
                                        className="rounded border-[var(--color-border)] bg-[var(--color-bg-tertiary)]"
                                    />
                                    <label htmlFor={`third-${pool.id}`} className="text-sm">Include 3rd Place Match</label>
                                </div>
                            </>
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
