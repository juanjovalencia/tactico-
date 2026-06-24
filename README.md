# Football Scouting & Stats Backend API

This is the backend API for a football scouting, manual enrollment, and statistical analytics web application. It is built using Node.js, Express, TypeScript, and Prisma ORM with PostgreSQL.

---

## Technical Features

1. **Atomic Match Registration**: Submits match information, lineup (which players were called up, started, substituted), and statistics (goals, assists, cards) in a single atomic transaction (`Prisma.$transaction`).
2. **Substitution Validation**:
   - Compiles exact minutes played: starting players default to 90 minutes.
   - If a player is marked as substituted, the system requires their replacement (`substituted_by_id`) and the substitution minute.
   - Automatically sets the substituted player's minutes equal to the `substitution_minute` and calculates the replacement's minutes as `90 - substitution_minute`.
3. **Card Consistency Check**: If a player accumulates `yellow_cards = 2` in a match, the `red_card` field is automatically set to `true`.
4. **Aggregated Reports**:
   - **Player Report**: Calculates total minutes, goals, assists, cards, matches played, and starting titularity percentage in a tournament.
   - **Club Report**: Tabulates wins, draws, losses, goals for, goals against, points, and tactical system usage distribution.

---

## DB Schema Diagram (Prisma)

Refer to [schema.prisma](prisma/schema.prisma) for full definition. The schema manages:
* `tournaments`
* `stadiums`
* `clubs` (contains `stadium_id`, current `tactical_system`)
* `players` (contains `current_club_id`)
* `matches` (references home club, away club, tournament, stadium)
* `match_lineups` (relates match, player, and club with statuses: `titular`, `suplente`, `no_jugo`)
* `match_stats` (relates match and player to record goals, assists, yellow cards, red cards)

---

## Getting Started

### 1. Prerequisites
- Docker (optional but recommended for running PostgreSQL)
- Node.js (v18+)

### 2. Setup Database
To run a local PostgreSQL container:
```bash
docker-compose up -d
```

Copy the `.env` configurations or adjust variables if needed:
```ini
DATABASE_URL="postgresql://postgres:password@localhost:5432/football_scouting?schema=public"
PORT=3000
```

### 3. Install Dependencies & Generate Client
```bash
npm install
npm run prisma:generate
```

### 4. Run Migrations & Seed Database
```bash
npm run prisma:migrate
npm run seed
```

### 5. Start Development Server
```bash
npm run dev
```
The server runs on [http://localhost:3000](http://localhost:3000).

---

## API Endpoints

### 1. General CRUD
* **Tournaments**:
  * `POST /api/tournaments` (Body: `{ "name": "Tournament Name" }`)
  * `GET /api/tournaments`
* **Stadiums**:
  * `POST /api/stadiums` (Body: `{ "name": "Stadium Name" }`)
  * `GET /api/stadiums`
* **Clubs**:
  * `POST /api/clubs` (Body: `{ "name": "Club Name", "tacticalSystem": "4-3-3", "stadiumId": "UUID" }`)
  * `GET /api/clubs`
* **Players**:
  * `POST /api/players` (Body: `{ "name": "Player Name", "currentClubId": "UUID" }`)
  * `GET /api/players`
* **Matches (View)**:
  * `GET /api/matches`
  * `GET /api/matches/:id`

### 2. Match Sheets Registration
* `POST /api/matches/register`
  * Payload structure registers the entire match sheet (lineup & stats) atomically.
  * **Example Payload**:
    ```json
    {
      "tournamentId": "tournament-uuid",
      "matchday": 1,
      "date": "2026-06-23T20:00:00.000Z",
      "homeClubId": "home-club-uuid",
      "awayClubId": "away-club-uuid",
      "stadiumId": "stadium-uuid",
      "lineups": [
        {
          "playerId": "player-1-uuid",
          "clubId": "home-club-uuid",
          "isCalledUp": true,
          "status": "titular",
          "isSubstituted": true,
          "substitutedById": "player-2-uuid",
          "substitutionMinute": 65
        },
        {
          "playerId": "player-2-uuid",
          "clubId": "home-club-uuid",
          "isCalledUp": true,
          "status": "suplente"
        }
      ],
      "stats": [
        {
          "playerId": "player-1-uuid",
          "goals": 1,
          "assists": 0,
          "yellowCards": 2
        }
      ]
    }
    ```

### 3. Reports Endpoints
* **Player Report**: `GET /api/reports/players?tournamentId=...&playerId=...`
  * Can query all players or pass `playerId` for detailed stats.
* **Club Report**: `GET /api/reports/clubs?tournamentId=...`
  * Returns general standings table, goals for/against, and tactical systems distribution.
