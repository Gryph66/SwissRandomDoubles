import { nanoid } from 'nanoid';
import type { Player, Match, Table, PartnerHistory, MatchHistory } from '../types';
import { addRoundLog, type RoundLog, type PairingLogEntry, type PlayerSnapshot, type MatchPairingLog } from './pairingLog';

interface PairingResult {
  matches: Match[];
  byePlayer: Player | null;
}

interface TeamPair {
  player1: Player;
  player2: Player;
}

// Logging state for current round generation
let currentRoundLog: {
  round: number;
  entries: PairingLogEntry[];
  standingsSnapshot: PlayerSnapshot[];
  finalPairings: MatchPairingLog[];
} | null = null;

function logEntry(phase: PairingLogEntry['phase'], decision: string, details: string[] = []): void {
  if (currentRoundLog) {
    currentRoundLog.entries.push({
      timestamp: new Date().toISOString(),
      round: currentRoundLog.round,
      phase,
      decision,
      details,
    });
  }
}

function getPlayerName(player: Player): string {
  return player.name;
}

/**
 * Generate pairings for a round
 * Round 1: Random partners, random matchups
 * Round 2+: Partners based on standings, Swiss matchups
 */
export function generateRoundPairings(
  players: Player[],
  existingMatches: Match[],
  round: number,
  tables: Table[],
  assignTables: boolean
): PairingResult {
  const activePlayers = players.filter((p) => p.active);
  
  // Initialize logging for this round
  currentRoundLog = {
    round,
    entries: [],
    standingsSnapshot: [],
    finalPairings: [],
  };
  
  // Create standings snapshot for log
  const sortedForSnapshot = [...activePlayers].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aDiff = a.pointsFor - a.pointsAgainst;
    const bDiff = b.pointsFor - b.pointsAgainst;
    if (bDiff !== aDiff) return bDiff - aDiff;
    return b.pointsFor - a.pointsFor;
  });
  
  currentRoundLog.standingsSnapshot = sortedForSnapshot.map((p, idx) => ({
    rank: idx + 1,
    name: p.name,
    wins: p.wins,
    losses: p.losses,
    ties: p.ties,
    pointDiff: p.pointsFor - p.pointsAgainst,
    byeCount: p.byeCount,
  }));
  
  logEntry('team_formation', `Starting Round ${round} pairing generation`, [
    `Active players: ${activePlayers.length}`,
    `Byes needed: ${activePlayers.length % 4 === 0 ? 0 : (4 - (activePlayers.length % 4)) % 4 || activePlayers.length % 4}`,
    round === 1 ? 'Using RANDOM pairing (Round 1)' : 'Using SWISS pairing (Round 2+)',
  ]);
  
  // Build history from existing matches
  const partnerHistory = buildPartnerHistory(existingMatches);
  const matchHistory = buildMatchHistory(existingMatches);

  // Handle players not divisible by 4 - assign byes
  // For doubles: need exactly divisible by 4 (teams of 2 vs teams of 2)
  let playersForRound = [...activePlayers];
  const byePlayers: Player[] = [];

  // Assign byes until we have a number divisible by 4
  while (playersForRound.length % 4 !== 0 && playersForRound.length > 0) {
    const byePlayer = selectByePlayer(playersForRound, round);
    byePlayers.push(byePlayer);
    playersForRound = playersForRound.filter((p) => p.id !== byePlayer.id);
  }

  // Check if we still have enough players for at least one match
  if (playersForRound.length < 4) {
    // Handle edge case: fewer than 4 players remaining
    const matches: Match[] = [];
    
    // Add bye matches for all bye players
    byePlayers.forEach((p) => {
      matches.push(createByeMatch(p, round, existingMatches));
      currentRoundLog!.finalPairings.push({
        team1: [p.name],
        team2: null,
        isBye: true,
        reasoning: 'Not enough players for a match',
      });
    });
    
    // Give remaining players byes too
    playersForRound.forEach((p) => {
      matches.push(createByeMatch(p, round, existingMatches));
      currentRoundLog!.finalPairings.push({
        team1: [p.name],
        team2: null,
        isBye: true,
        reasoning: 'Not enough players for a match',
      });
    });
    
    saveRoundLog(activePlayers.length, byePlayers.length + playersForRound.length);
    return { matches, byePlayer: byePlayers[0] || null };
  }

  // Generate teams based on round
  const teams = round === 1
    ? generateRandomTeams(playersForRound)
    : generateSwissTeams(playersForRound, partnerHistory);

  // Generate match pairings
  const matchPairings = round === 1
    ? generateRandomMatchups(teams)
    : generateSwissMatchups(teams, matchHistory, players);

  // Assign tables if enabled
  const sortedTables = [...tables].sort((a, b) => a.order - b.order);

  // Create match objects and log them
  const matches: Match[] = matchPairings.map((pairing, idx) => {
    const tableName = assignTables && sortedTables[idx] ? sortedTables[idx].name : undefined;
    
    currentRoundLog!.finalPairings.push({
      table: tableName,
      team1: [getPlayerName(pairing.team1.player1), getPlayerName(pairing.team1.player2)],
      team2: [getPlayerName(pairing.team2.player1), getPlayerName(pairing.team2.player2)],
      isBye: false,
      reasoning: round === 1 
        ? 'Random pairing (Round 1)' 
        : 'Swiss pairing based on combined team standings',
    });
    
    return {
      id: nanoid(8),
      round,
      team1: [pairing.team1.player1.id, pairing.team1.player2.id],
      team2: [pairing.team2.player1.id, pairing.team2.player2.id],
      score1: null,
      score2: null,
      twenties1: 0,
      twenties2: 0,
      tableId: assignTables && sortedTables[idx] ? sortedTables[idx].id : null,
      completed: false,
      isBye: false,
    };
  });

  // Add bye matches for all bye players
  byePlayers.forEach((p) => {
    matches.push(createByeMatch(p, round, existingMatches));
  });

  saveRoundLog(activePlayers.length, byePlayers.length);
  return { matches, byePlayer: byePlayers[0] || null };
}

function saveRoundLog(playerCount: number, byesNeeded: number): void {
  if (currentRoundLog) {
    const roundLog: RoundLog = {
      round: currentRoundLog.round,
      generatedAt: new Date().toISOString(),
      playerCount,
      byesNeeded,
      entries: currentRoundLog.entries,
      standingsSnapshot: currentRoundLog.standingsSnapshot,
      finalPairings: currentRoundLog.finalPairings,
    };
    addRoundLog(roundLog);
    currentRoundLog = null;
  }
}

/**
 * Select player for bye
 * Round 1: Completely random
 * Round 2+: Start from lowest ranked player and work up
 *   - Give bye to the lowest ranked player who hasn't had a bye yet
 *   - No one gets 2 byes until everyone has had 1
 */
function selectByePlayer(players: Player[], round: number): Player {
  if (round === 1) {
    // Round 1: Completely random
    const randomIndex = Math.floor(Math.random() * players.length);
    const selected = players[randomIndex];
    logEntry('bye_selection', `Selected ${getPlayerName(selected)} for bye (Random - Round 1)`, [
      `Randomly selected from ${players.length} players`,
    ]);
    return selected;
  }
  
  // Round 2+: Sort by standings (best to worst)
  // Best players at index 0, worst players at end
  const sorted = [...players].sort((a, b) => {
    // Primary: wins (more is better)
    if (b.wins !== a.wins) return b.wins - a.wins;
    // Secondary: point differential
    const aDiff = a.pointsFor - a.pointsAgainst;
    const bDiff = b.pointsFor - b.pointsAgainst;
    if (bDiff !== aDiff) return bDiff - aDiff;
    // Tertiary: points for
    return b.pointsFor - a.pointsFor;
  });
  
  // Find the minimum bye count (no one gets 2 byes until everyone has 1)
  const minByeCount = Math.min(...sorted.map(p => p.byeCount));
  const playersWithMinByes = sorted.filter(p => p.byeCount === minByeCount);
  
  logEntry('bye_selection', `Evaluating bye candidates`, [
    `Minimum bye count: ${minByeCount}`,
    `Players eligible (have ${minByeCount} byes): ${playersWithMinByes.length}`,
    `Searching from bottom of standings upward...`,
  ]);
  
  // Start from the BOTTOM (worst ranked) and work UP
  // Find the first player with the minimum bye count
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].byeCount === minByeCount) {
      const selected = sorted[i];
      const rank = i + 1;
      logEntry('bye_selection', `Selected ${getPlayerName(selected)} for bye`, [
        `Rank: ${rank} of ${sorted.length} (lower = worse)`,
        `Record: ${selected.wins}W-${selected.losses}L-${selected.ties}T`,
        `Point diff: ${selected.pointsFor - selected.pointsAgainst >= 0 ? '+' : ''}${selected.pointsFor - selected.pointsAgainst}`,
        `Previous byes: ${selected.byeCount}`,
        `Reason: Lowest ranked player with minimum bye count (${minByeCount})`,
      ]);
      
      currentRoundLog?.finalPairings.push({
        team1: [getPlayerName(selected)],
        team2: null,
        isBye: true,
        reasoning: `Rank ${rank}/${sorted.length}, ${selected.byeCount} previous byes - lowest ranked eligible`,
      });
      
      return selected;
    }
  }
  
  // Fallback: shouldn't reach here, but just in case
  const fallback = sorted[sorted.length - 1];
  logEntry('bye_selection', `Fallback: Selected ${getPlayerName(fallback)} for bye`, [
    'No eligible player found with min bye count - using last player',
  ]);
  return fallback;
}

/**
 * Create a bye match for a player
 * Awards average points (4) and average 20s from the tournament so far
 */
function createByeMatch(player: Player, round: number, existingMatches: Match[]): Match {
  // Calculate average 20s per player per match from completed matches
  let averageTwenties = 0;
  
  if (existingMatches.length > 0) {
    const completedMatches = existingMatches.filter(m => m.completed && !m.isBye);
    if (completedMatches.length > 0) {
      const totalTwenties = completedMatches.reduce((sum, m) => {
        return sum + (m.twenties1 || 0) + (m.twenties2 || 0);
      }, 0);
      // Each match has 4 players (2 per team), so divide by matches * 4
      const totalPlayerMatches = completedMatches.length * 4;
      averageTwenties = Math.round(totalTwenties / totalPlayerMatches);
    }
  }

  return {
    id: nanoid(8),
    round,
    team1: [player.id],
    team2: null,
    score1: 4, // Average points
    score2: null,
    twenties1: averageTwenties,
    twenties2: 0,
    tableId: null,
    completed: true, // Byes are auto-completed
    isBye: true,
  };
}

/**
 * Round 1: Generate random team pairings
 */
function generateRandomTeams(players: Player[]): TeamPair[] {
  const shuffled = shuffleArray([...players]);
  const teams: TeamPair[] = [];

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    teams.push({
      player1: shuffled[i],
      player2: shuffled[i + 1],
    });
  }

  return teams;
}

/**
 * Round 2+: Generate teams based on standings
 * Pair players with similar records, avoiding repeat partners
 */
function generateSwissTeams(players: Player[], partnerHistory: PartnerHistory): TeamPair[] {
  // Sort players by standings (wins, then point diff)
  const sorted = [...players].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aDiff = a.pointsFor - a.pointsAgainst;
    const bDiff = b.pointsFor - b.pointsAgainst;
    if (bDiff !== aDiff) return bDiff - aDiff;
    return b.pointsFor - a.pointsFor;
  });

  logEntry('team_formation', 'Forming teams based on standings (Swiss)', [
    'Pairing adjacent players in standings',
    'Avoiding repeat partners when possible',
  ]);

  const teams: TeamPair[] = [];
  const used = new Set<string>();

  // Pair adjacent players in standings, checking for valid pairings
  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;

    const player1 = sorted[i];
    let partner: Player | null = null;
    let usedFallback = false;

    // Find the next available player who hasn't been a partner before
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].id)) continue;

      const candidate = sorted[j];
      const hasBeenPartner = partnerHistory[player1.id]?.has(candidate.id) ?? false;

      if (!hasBeenPartner) {
        partner = candidate;
        break;
      }
    }

    // If no valid partner found (everyone has been partners), just take the next available
    if (!partner) {
      usedFallback = true;
      for (let j = i + 1; j < sorted.length; j++) {
        if (!used.has(sorted[j].id)) {
          partner = sorted[j];
          break;
        }
      }
    }

    if (partner) {
      teams.push({ player1, player2: partner });
      used.add(player1.id);
      used.add(partner.id);
      
      logEntry('team_formation', `Team formed: ${getPlayerName(player1)} + ${getPlayerName(partner)}`, [
        `${getPlayerName(player1)}: Rank ${i + 1}, ${player1.wins}W`,
        `${getPlayerName(partner)}: ${partner.wins}W`,
        usedFallback ? '⚠️ Had to use repeat partner (all others already partnered before)' : '✓ First time as partners',
      ]);
    }
  }

  return teams;
}

/**
 * Round 1: Random match pairings between teams
 */
function generateRandomMatchups(teams: TeamPair[]): { team1: TeamPair; team2: TeamPair }[] {
  const shuffled = shuffleArray([...teams]);
  const matchups: { team1: TeamPair; team2: TeamPair }[] = [];

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    matchups.push({
      team1: shuffled[i],
      team2: shuffled[i + 1],
    });
  }

  return matchups;
}

/**
 * Round 2+: Swiss-style match pairings
 * Pair teams with similar combined standings, avoiding repeat matchups
 */
function generateSwissMatchups(
  teams: TeamPair[],
  matchHistory: MatchHistory,
  allPlayers: Player[]
): { team1: TeamPair; team2: TeamPair }[] {
  // Calculate combined standings for each team
  const teamsWithRank = teams.map((team) => {
    const p1 = allPlayers.find((p) => p.id === team.player1.id) ?? team.player1;
    const p2 = allPlayers.find((p) => p.id === team.player2.id) ?? team.player2;
    
    const combinedWins = p1.wins + p2.wins;
    const combinedDiff = (p1.pointsFor - p1.pointsAgainst) + (p2.pointsFor - p2.pointsAgainst);
    
    return {
      team,
      combinedWins,
      combinedDiff,
      teamKey: getTeamKey(team.player1.id, team.player2.id),
      displayName: `${getPlayerName(team.player1)} + ${getPlayerName(team.player2)}`,
    };
  });

  // Sort by combined standings
  teamsWithRank.sort((a, b) => {
    if (b.combinedWins !== a.combinedWins) return b.combinedWins - a.combinedWins;
    return b.combinedDiff - a.combinedDiff;
  });

  logEntry('match_pairing', 'Pairing teams by combined standings (Swiss)', [
    'Teams sorted by combined wins, then combined point differential',
    'Avoiding repeat matchups when possible',
  ]);

  const matchups: { team1: TeamPair; team2: TeamPair }[] = [];
  const used = new Set<string>();

  // Pair adjacent teams, checking for valid matchups
  for (let i = 0; i < teamsWithRank.length; i++) {
    if (used.has(teamsWithRank[i].teamKey)) continue;

    const team1Data = teamsWithRank[i];
    let opponent: typeof team1Data | null = null;
    let usedFallback = false;

    // Find the next available team that hasn't played this team before
    for (let j = i + 1; j < teamsWithRank.length; j++) {
      if (used.has(teamsWithRank[j].teamKey)) continue;

      const candidate = teamsWithRank[j];
      const hasPlayed = matchHistory[team1Data.teamKey]?.has(candidate.teamKey) ?? false;

      if (!hasPlayed) {
        opponent = candidate;
        break;
      }
    }

    // If no valid opponent found, take the next available
    if (!opponent) {
      usedFallback = true;
      for (let j = i + 1; j < teamsWithRank.length; j++) {
        if (!used.has(teamsWithRank[j].teamKey)) {
          opponent = teamsWithRank[j];
          break;
        }
      }
    }

    if (opponent) {
      matchups.push({
        team1: team1Data.team,
        team2: opponent.team,
      });
      used.add(team1Data.teamKey);
      used.add(opponent.teamKey);
      
      logEntry('match_pairing', `Match: ${team1Data.displayName} vs ${opponent.displayName}`, [
        `Team 1: ${team1Data.combinedWins} combined wins, ${team1Data.combinedDiff >= 0 ? '+' : ''}${team1Data.combinedDiff} diff`,
        `Team 2: ${opponent.combinedWins} combined wins, ${opponent.combinedDiff >= 0 ? '+' : ''}${opponent.combinedDiff} diff`,
        usedFallback ? '⚠️ Repeat matchup (no other valid opponents)' : '✓ First time playing each other',
      ]);
    }
  }

  return matchups;
}

/**
 * Build partner history from existing matches
 */
function buildPartnerHistory(matches: Match[]): PartnerHistory {
  const history: PartnerHistory = {};

  matches.forEach((match) => {
    if (!match.isBye && match.team1.length === 2) {
      const [p1, p2] = match.team1 as [string, string];
      if (!history[p1]) history[p1] = new Set();
      if (!history[p2]) history[p2] = new Set();
      history[p1].add(p2);
      history[p2].add(p1);
    }
    if (match.team2 && match.team2.length === 2) {
      const [p1, p2] = match.team2 as [string, string];
      if (!history[p1]) history[p1] = new Set();
      if (!history[p2]) history[p2] = new Set();
      history[p1].add(p2);
      history[p2].add(p1);
    }
  });

  return history;
}

/**
 * Build match history from existing matches
 */
function buildMatchHistory(matches: Match[]): MatchHistory {
  const history: MatchHistory = {};

  matches.forEach((match) => {
    if (!match.isBye && match.team2 && match.team1.length === 2) {
      const team1Key = getTeamKey(match.team1[0], match.team1[1]!);
      const team2Key = getTeamKey(match.team2[0], match.team2[1]!);

      if (!history[team1Key]) history[team1Key] = new Set();
      if (!history[team2Key]) history[team2Key] = new Set();

      history[team1Key].add(team2Key);
      history[team2Key].add(team1Key);
    }
  });

  return history;
}

/**
 * Generate a consistent team key for history lookup
 */
function getTeamKey(p1: string, p2: string): string {
  return [p1, p2].sort().join('-');
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

