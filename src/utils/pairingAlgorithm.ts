import { nanoid } from 'nanoid';
import type { Player, Match, Table, PartnerHistory, MatchHistory } from '../types';

interface PairingResult {
  matches: Match[];
  byePlayer: Player | null;
}

interface TeamPair {
  player1: Player;
  player2: Player;
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
    });
    
    // Give remaining players byes too
    playersForRound.forEach((p) => {
      matches.push(createByeMatch(p, round, existingMatches));
    });
    
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

  // Create match objects
  const matches: Match[] = matchPairings.map((pairing, idx) => ({
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
  }));

  // Add bye matches for all bye players
  byePlayers.forEach((p) => {
    matches.push(createByeMatch(p, round, existingMatches));
  });

  return { matches, byePlayer: byePlayers[0] || null };
}

/**
 * Select player for bye
 * Round 1: Completely random
 * Round 2+: Random from bottom 40% of players (by standings), preferring those with fewer byes
 */
function selectByePlayer(players: Player[], round: number): Player {
  if (round === 1) {
    // Round 1: Completely random
    const randomIndex = Math.floor(Math.random() * players.length);
    return players[randomIndex];
  }
  
  // Round 2+: Random from bottom 40% of players by standings
  // Sort by standings (wins desc, then point diff desc)
  const sorted = [...players].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aDiff = a.pointsFor - a.pointsAgainst;
    const bDiff = b.pointsFor - b.pointsAgainst;
    return bDiff - aDiff;
  });
  
  // Get bottom 40% of players
  const bottom40Count = Math.max(1, Math.ceil(sorted.length * 0.4));
  const bottom40Players = sorted.slice(-bottom40Count);
  
  // Among bottom 40%, prefer those with fewest byes
  const minByeCount = Math.min(...bottom40Players.map(p => p.byeCount));
  const eligiblePlayers = bottom40Players.filter(p => p.byeCount === minByeCount);
  
  // Randomly select from eligible players
  const randomIndex = Math.floor(Math.random() * eligiblePlayers.length);
  return eligiblePlayers[randomIndex];
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

  const teams: TeamPair[] = [];
  const used = new Set<string>();

  // Pair adjacent players in standings, checking for valid pairings
  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;

    const player1 = sorted[i];
    let partner: Player | null = null;

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
    };
  });

  // Sort by combined standings
  teamsWithRank.sort((a, b) => {
    if (b.combinedWins !== a.combinedWins) return b.combinedWins - a.combinedWins;
    return b.combinedDiff - a.combinedDiff;
  });

  const matchups: { team1: TeamPair; team2: TeamPair }[] = [];
  const used = new Set<string>();

  // Pair adjacent teams, checking for valid matchups
  for (let i = 0; i < teamsWithRank.length; i++) {
    if (used.has(teamsWithRank[i].teamKey)) continue;

    const team1Data = teamsWithRank[i];
    let opponent: typeof team1Data | null = null;

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
    if (!match.isBye && match.team2) {
      const team1Key = getTeamKey(match.team1[0], match.team1[1]);
      const team2Key = getTeamKey(match.team2[0], match.team2[1]);

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

