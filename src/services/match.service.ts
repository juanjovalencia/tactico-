import prisma from '../config/prisma';
export type LineupStatus = 'titular' | 'suplente' | 'no_jugo';

export interface LineupInput {
  playerId: string;
  clubId: string;
  isCalledUp?: boolean;
  status: LineupStatus;
  isSubstituted?: boolean;
  substitutedById?: string | null;
  substitutionMinute?: number | null;
}

export interface StatInput {
  playerId: string;
  goals?: number;
  assists?: number;
  yellowCards?: number;
  redCard?: boolean;
}

export interface RegisterMatchInput {
  tournamentId: string;
  matchday: number;
  date: string | Date;
  homeClubId: string;
  awayClubId: string;
  stadiumId: string;
  lineups: LineupInput[];
  stats: StatInput[];
}

export class MatchService {
  /**
   * Registers a full match with its players lineup and statistics inside a transaction.
   */
  static async registerMatch(input: RegisterMatchInput) {
    const { tournamentId, matchday, date, homeClubId, awayClubId, stadiumId, lineups, stats } = input;

    // 1. Basic validation of foreign keys existence
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new Error(`Tournament with ID ${tournamentId} not found`);

    const stadium = await prisma.stadium.findUnique({ where: { id: stadiumId } });
    if (!stadium) throw new Error(`Stadium with ID ${stadiumId} not found`);

    const homeClub = await prisma.club.findUnique({ where: { id: homeClubId } });
    if (!homeClub) throw new Error(`Home Club with ID ${homeClubId} not found`);

    const awayClub = await prisma.club.findUnique({ where: { id: awayClubId } });
    if (!awayClub) throw new Error(`Away Club with ID ${awayClubId} not found`);

    // 2. Validate players belong to the match lineups and correct clubs
    const playerIds = lineups.map(l => l.playerId);
    const uniquePlayerIds = new Set(playerIds);
    if (uniquePlayerIds.size !== playerIds.length) {
      throw new Error('A player cannot be registered multiple times in the lineup');
    }

    // Verify all players exist in the database
    const dbPlayers = await prisma.player.findMany({
      where: { id: { in: playerIds } }
    });
    if (dbPlayers.length !== playerIds.length) {
      const dbPlayerIds = new Set(dbPlayers.map(p => p.id));
      const missingIds = playerIds.filter(id => !dbPlayerIds.has(id));
      throw new Error(`The following players were not found: ${missingIds.join(', ')}`);
    }

    // 3. Process Lineups & Substitutions to calculate minutes played
    const processedLineups = this.calculateMinutesAndValidateSubstitutions(lineups);

    // 4. Process Stats (Consistency of Cards)
    const processedStats = stats.map(stat => {
      const yellowCards = stat.yellowCards ?? 0;
      let redCard = stat.redCard ?? false;

      // Card Consistency rule: If yellow cards reaches 2, red card must be true
      if (yellowCards >= 2) {
        redCard = true;
      }

      // Check if player is part of the lineup
      const playerInLineup = lineups.find(l => l.playerId === stat.playerId);
      if (!playerInLineup) {
        throw new Error(`Cannot register stats for player ${stat.playerId} because they are not in the match lineup`);
      }

      // If the player did not play (status = no_jugo or isCalledUp = false), verify they don't have stats (goals, assists, cards)
      if (playerInLineup.status === 'no_jugo' || playerInLineup.isCalledUp === false) {
        const hasStats = (stat.goals ?? 0) > 0 || (stat.assists ?? 0) > 0 || yellowCards > 0 || redCard;
        if (hasStats) {
          throw new Error(`Player ${stat.playerId} cannot have stats since their status in the lineup is 'no_jugo' or they were not called up`);
        }
      }

      return {
        playerId: stat.playerId,
        goals: stat.goals ?? 0,
        assists: stat.assists ?? 0,
        yellowCards: Math.min(yellowCards, 2), // Cap yellow cards at 2
        redCard
      };
    });

    // 5. Execute DB transaction to register the Match, Lineups and Stats
    return prisma.$transaction(async (tx) => {
      // Create Match
      const match = await tx.match.create({
        data: {
          tournamentId,
          matchday,
          date: new Date(date),
          homeClubId,
          awayClubId,
          stadiumId
        }
      });

      // Create Lineups
      await tx.matchLineup.createMany({
        data: processedLineups.map(lineup => ({
          matchId: match.id,
          playerId: lineup.playerId,
          clubId: lineup.clubId,
          isCalledUp: lineup.isCalledUp ?? true,
          status: lineup.status,
          minutesPlayed: lineup.minutesPlayed,
          isSubstituted: lineup.isSubstituted ?? false,
          substitutedById: lineup.substitutedById,
          substitutionMinute: lineup.substitutionMinute
        }))
      });

      // Create Stats
      await tx.matchStat.createMany({
        data: processedStats.map(stat => ({
          matchId: match.id,
          playerId: stat.playerId,
          goals: stat.goals,
          assists: stat.assists,
          yellowCards: stat.yellowCards,
          redCard: stat.redCard
        }))
      });

      // Retrieve full registered match details
      return tx.match.findUnique({
        where: { id: match.id },
        include: {
          tournament: true,
          homeClub: true,
          awayClub: true,
          stadium: true,
          lineups: {
            include: {
              player: true,
              substitutedBy: true
            }
          },
          stats: {
            include: {
              player: true
            }
          }
        }
      });
    });
  }

  /**
   * Helper to calculate minutes played and validate substitution requirements.
   */
  private static calculateMinutesAndValidateSubstitutions(lineups: LineupInput[]) {
    // Make a copy of lineups to add minutesPlayed field
    const result = lineups.map(l => ({
      ...l,
      minutesPlayed: 0
    }));

    // Initialize default minutes based on starting status
    for (const player of result) {
      if (player.status === 'titular') {
        player.minutesPlayed = 90;
      } else {
        player.minutesPlayed = 0;
      }
    }

    // Process substitutions
    for (const playerA of result) {
      const isSubbed = playerA.isSubstituted ?? false;

      if (isSubbed) {
        // Validation: Must provide substitutedById and substitutionMinute
        if (!playerA.substitutedById) {
          throw new Error(`Player ${playerA.playerId} is marked as substituted but has no substitutedById`);
        }
        if (playerA.substitutionMinute === undefined || playerA.substitutionMinute === null) {
          throw new Error(`Player ${playerA.playerId} is marked as substituted but has no substitutionMinute`);
        }

        const minute = playerA.substitutionMinute;
        if (minute < 0 || minute > 90) {
          throw new Error(`Substitution minute must be between 0 and 90. Received: ${minute}`);
        }

        // Validate substituted player B exists in the same lineup and defends the same club
        const playerB = result.find(p => p.playerId === playerA.substitutedById);
        if (!playerB) {
          throw new Error(`Substituted player ${playerA.substitutedById} was not found in the match lineups`);
        }
        if (playerB.clubId !== playerA.clubId) {
          throw new Error(`Substitution error: Player ${playerA.playerId} and ${playerB.playerId} must play for the same club`);
        }

        // Validate that player B is not registered as "no_jugo"
        if (playerB.status === 'no_jugo') {
          throw new Error(`Substitution error: Player ${playerB.playerId} cannot substitute in because their status is 'no_jugo'`);
        }

        // Business Logic:
        // Minutes of Player A become equal to substitution_minute
        playerA.minutesPlayed = minute;

        // Minutes of Player B are calculated as: 90 - substitution_minute
        // If Player B is also substituted, this might get adjusted, but for simple substitution:
        playerB.minutesPlayed += (90 - minute);
      }
    }

    return result;
  }
}
