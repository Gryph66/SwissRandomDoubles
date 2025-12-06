# Swiss Random Doubles Tournament App

## Overview

Build a React/TypeScript web application for running Swiss-style tournaments with randomly assigned doubles partners that change each round based on player performance.

---

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite (fast, modern tooling)
- **Styling**: Tailwind CSS (rapid UI development, Challonge-inspired design)
- **Real-time Sync**: Supabase (free tier, real-time database for multi-device)
- **State Management**: Zustand + Supabase real-time subscriptions

## Multi-Device Architecture

- **Host View**: Main display projected on screen (full admin controls)
- **Spectator View**: Mobile-friendly view via shareable link/QR code
- **Player Score Entry**: Optional - players submit scores, admin approves

## Design Guidelines

- **No emojis** - clean, professional typography throughout
- Use icons sparingly (minimal, functional icons only where needed)
- Projection-friendly: high contrast, large readable text

---

## Core Algorithm

### Partner Assignment (Round 2+)

1. Rank all players by individual wins (tiebreaker: point differential)
2. Pair adjacent players in standings (1st with 2nd, 3rd with 4th, etc.)
3. Check for repeat pairings - if found, swap with next available valid pairing
4. Constraint: no player can partner with same person twice

### Match Pairing (Swiss-style)

1. Rank teams by combined player standings
2. Pair teams with similar rankings (1st vs 2nd, 3rd vs 4th, etc.)
3. Check for repeat matchups - if found, swap with next valid pairing
4. Constraint: same two teams cannot play each other twice

### Bye Handling

- Odd number of players: one player sits out each round
- Bye player receives average points (4 points) and a "win" for standings
- Rotate byes to avoid same player sitting out twice before everyone has

---

## Key Features

### Tournament Setup
- Tournament name
- Player registration (add/remove players)
- Number of rounds
- Table/Board assignment (optional)
  - Define tables with custom names (numeric, alphabetic, or custom)
  - App assigns matches to specific tables
  - If disabled, teams find their own table
- Score entry mode (admin-only or player-enabled)

### Round View
- Current round pairings with team compositions
- Table assignments (if enabled)
- Score entry (0-8 points per team, must sum to 8)
- 20s count entry per team
- Match completion status

### Standings
- Individual player rankings
- W-L-T record
- Points for/against and differential
- 20s Champion tracking (individual totals from all team matches)

### Match History
- All completed matches with scores
- Partner history for each player

### Admin Panel
- Edit scores after entry
- Regenerate pairings if needed
- Add/remove players mid-tournament
- Manual bye assignment

---

## Data Model

```typescript
interface Player {
  id: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  twenties: number;        // Total 20s across all matches
  byeCount: number;        // Track bye rounds
}

interface Match {
  id: string;
  round: number;
  team1: [playerId, playerId];
  team2: [playerId, playerId];
  score1: number | null;
  score2: number | null;
  twenties1: number;       // 20s scored by team 1
  twenties2: number;       // 20s scored by team 2
  tableId: string | null;  // Assigned table (if table assignment enabled)
  completed: boolean;
  submittedBy: 'admin' | playerId | null;  // Track who entered score
  confirmed: boolean;      // Admin confirmation (if player-submitted)
}

interface Table {
  id: string;
  name: string;            // "1", "A", "Main Stage", etc.
  order: number;           // Display order
}

interface Tournament {
  id: string;
  name: string;
  players: Player[];
  matches: Match[];
  tables: Table[];
  currentRound: number;
  totalRounds: number;
  status: 'setup' | 'active' | 'completed';
  settings: {
    tableAssignment: boolean;
    playerScoreEntry: boolean;
  };
  shareCode: string;       // For spectator/player access
}
```

---

## File Structure

```
src/
├── components/
│   ├── setup/
│   │   ├── TournamentSetup.tsx
│   │   ├── PlayerRegistration.tsx
│   │   └── TableSetup.tsx
│   ├── round/
│   │   ├── RoundView.tsx
│   │   ├── MatchCard.tsx
│   │   └── ScoreEntry.tsx
│   ├── standings/
│   │   ├── Standings.tsx
│   │   └── TwentiesLeaderboard.tsx
│   ├── admin/
│   │   └── AdminPanel.tsx
│   └── shared/
│       ├── Header.tsx
│       └── QRCode.tsx
├── hooks/
│   ├── useTournament.ts
│   └── useSupabase.ts
├── utils/
│   ├── pairingAlgorithm.ts
│   ├── byeHandler.ts
│   └── scoring.ts
├── store/
│   └── tournamentStore.ts
├── lib/
│   └── supabase.ts
├── App.tsx
└── main.tsx
```

---

## Implementation Phases

### Phase 1 - Core MVP
- [ ] Project setup (Vite + React + TypeScript + Tailwind + Supabase)
- [ ] Data model and Supabase schema
- [ ] Player registration
- [ ] Round 1 random partner + match generation
- [ ] Score + 20s entry
- [ ] Basic standings

### Phase 2 - Swiss Logic
- [ ] Partner assignment based on standings
- [ ] Swiss match pairing with repeat avoidance
- [ ] Bye handling for odd players
- [ ] Table assignment

### Phase 3 - Multi-Device
- [ ] Real-time sync across devices
- [ ] Spectator view with QR code
- [ ] Optional player score submission
- [ ] Admin approval workflow

### Phase 4 - Polish
- [ ] Challonge-inspired visual design
- [ ] 20s Champion display
- [ ] Match history view
- [ ] Export tournament results
- [ ] Projection-optimized layout

