-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "stadiums" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tactical_system" TEXT,
    "stadium_id" TEXT,
    CONSTRAINT "clubs_stadium_id_fkey" FOREIGN KEY ("stadium_id") REFERENCES "stadiums" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "current_club_id" TEXT,
    CONSTRAINT "players_current_club_id_fkey" FOREIGN KEY ("current_club_id") REFERENCES "clubs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournament_id" TEXT NOT NULL,
    "matchday" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "home_club_id" TEXT NOT NULL,
    "away_club_id" TEXT NOT NULL,
    "stadium_id" TEXT NOT NULL,
    CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "matches_home_club_id_fkey" FOREIGN KEY ("home_club_id") REFERENCES "clubs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "matches_away_club_id_fkey" FOREIGN KEY ("away_club_id") REFERENCES "clubs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "matches_stadium_id_fkey" FOREIGN KEY ("stadium_id") REFERENCES "stadiums" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "match_lineups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "is_called_up" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL,
    "minutes_played" INTEGER NOT NULL DEFAULT 0,
    "is_substituted" BOOLEAN NOT NULL DEFAULT false,
    "substituted_by_id" TEXT,
    "substitution_minute" INTEGER,
    CONSTRAINT "match_lineups_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_lineups_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "match_lineups_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "match_lineups_substituted_by_id_fkey" FOREIGN KEY ("substituted_by_id") REFERENCES "players" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "match_stats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "yellow_cards" INTEGER NOT NULL DEFAULT 0,
    "red_card" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "match_stats_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
