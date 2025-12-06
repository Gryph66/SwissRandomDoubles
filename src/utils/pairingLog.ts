// Pairing decision log for Swiss tournament transparency

export interface PairingLogEntry {
  timestamp: string;
  round: number;
  phase: 'bye_selection' | 'team_formation' | 'match_pairing';
  decision: string;
  details: string[];
}

export interface RoundLog {
  round: number;
  generatedAt: string;
  playerCount: number;
  byesNeeded: number;
  entries: PairingLogEntry[];
  standingsSnapshot: PlayerSnapshot[];
  finalPairings: MatchPairingLog[];
}

export interface PlayerSnapshot {
  rank: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointDiff: number;
  byeCount: number;
}

export interface MatchPairingLog {
  table?: string;
  team1: string[];
  team2: string[] | null;
  isBye: boolean;
  reasoning: string;
}

// Global log storage
let pairingLogs: RoundLog[] = [];

export function clearPairingLogs(): void {
  pairingLogs = [];
}

export function getPairingLogs(): RoundLog[] {
  return [...pairingLogs];
}

export function addRoundLog(log: RoundLog): void {
  // Remove existing log for this round if any
  pairingLogs = pairingLogs.filter(l => l.round !== log.round);
  pairingLogs.push(log);
  pairingLogs.sort((a, b) => a.round - b.round);
}

export function generateLogText(logs?: RoundLog[]): string {
  const logsToUse = logs ?? pairingLogs;
  if (logsToUse.length === 0) {
    return 'No pairing logs available yet. Start a tournament and generate rounds to see logs.';
  }

  let text = '═══════════════════════════════════════════════════════════════\n';
  text += '                    SWISS PAIRING LOG\n';
  text += '═══════════════════════════════════════════════════════════════\n\n';

  text += 'ALGORITHM SUMMARY:\n';
  text += '─────────────────────────────────────────────────────────────────\n';
  text += `
ROUND 1:
  • Partners: Randomly assigned
  • Matchups: Randomly assigned
  • Byes: Randomly selected (if player count not divisible by 4)

ROUND 2+:
  • Standings calculated: Score → PF → PA → 20s
    - Score = Wins×2 + Ties×1
    - PF = Points For (higher is better)
    - PA = Points Against (lower is better)
    - 20s = Twenty count (higher is better)
  • Partners: Adjacent players in standings paired together
    - Avoids repeat partners when possible
  • Matchups: Teams with similar combined standings play each other
    - Avoids repeat team matchups when possible
  • Byes: 
    - Given to lowest ranked player without a bye
    - No one gets 2 byes until everyone has had 1
    - Worth: 1 point (tie) + 4 PF + 4 PA (4-4 tie) + average 20s

SCORING:
  • Win = 2 points
  • Tie = 1 point  
  • Loss = 0 points
  • Bye = Tie (1 point, 4-4 score, average 20s)
`;
  text += '\n';

  for (const roundLog of logsToUse) {
    text += '═══════════════════════════════════════════════════════════════\n';
    text += `ROUND ${roundLog.round}\n`;
    text += `Generated: ${roundLog.generatedAt}\n`;
    text += `Players: ${roundLog.playerCount} | Byes needed: ${roundLog.byesNeeded}\n`;
    text += '═══════════════════════════════════════════════════════════════\n\n';

    // Standings snapshot
    text += 'STANDINGS BEFORE PAIRING:\n';
    text += '─────────────────────────────────────────────────────────────────\n';
    text += 'Rank  Player                W   L   T   +/-  Byes\n';
    text += '─────────────────────────────────────────────────────────────────\n';
    for (const p of roundLog.standingsSnapshot) {
      const name = p.name.padEnd(20).substring(0, 20);
      const diff = p.pointDiff >= 0 ? `+${p.pointDiff}` : `${p.pointDiff}`;
      text += `${String(p.rank).padStart(4)}  ${name}  ${String(p.wins).padStart(2)}  ${String(p.losses).padStart(2)}  ${String(p.ties).padStart(2)}  ${diff.padStart(4)}  ${p.byeCount}\n`;
    }
    text += '\n';

    // Decision log
    text += 'PAIRING DECISIONS:\n';
    text += '─────────────────────────────────────────────────────────────────\n';
    for (const entry of roundLog.entries) {
      text += `[${entry.phase.toUpperCase()}] ${entry.decision}\n`;
      for (const detail of entry.details) {
        text += `    → ${detail}\n`;
      }
    }
    text += '\n';

    // Final pairings
    text += 'FINAL PAIRINGS:\n';
    text += '─────────────────────────────────────────────────────────────────\n';
    for (const match of roundLog.finalPairings) {
      if (match.isBye) {
        text += `  BYE: ${match.team1.join(' + ')}\n`;
        text += `        Reason: ${match.reasoning}\n`;
      } else {
        const table = match.table ? `[${match.table}] ` : '';
        text += `  ${table}${match.team1.join(' + ')}  vs  ${match.team2?.join(' + ')}\n`;
        text += `        Reason: ${match.reasoning}\n`;
      }
    }
    text += '\n\n';
  }

  return text;
}

export function downloadLog(logs?: RoundLog[]): void {
  // Only run in browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.log('downloadLog() is only available in browser environment');
    return;
  }
  
  const text = generateLogText(logs);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `swiss-pairing-log-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

