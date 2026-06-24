import { Request, Response } from 'express';
import prisma from '../config/prisma';

export class ReportController {
  /**
   * GET /api/reports/players?tournamentId=...&playerId=...
   * Generates a player report showing goals, assists, minutes, cards, and starting percentage.
   */
  static async getPlayerReport(req: Request, res: Response) {
    try {
      const { tournamentId, playerId } = req.query as { tournamentId?: string; playerId?: string };

      // Base filters
      const matchFilter: any = {};
      if (tournamentId) {
        matchFilter.tournamentId = tournamentId;
      }

      // If a specific player is requested
      if (playerId) {
        const player = await prisma.player.findUnique({
          where: { id: playerId },
          include: { currentClub: true }
        });
        if (!player) {
          return res.status(404).json({ error: 'Player not found' });
        }

        // Get all lineups for this player in the filtered matches
        const lineups = await prisma.matchLineup.findMany({
          where: {
            playerId,
            match: matchFilter
          },
          include: {
            match: true
          }
        });

        // Get all stats for this player in the filtered matches
        const stats = await prisma.matchStat.findMany({
          where: {
            playerId,
            match: matchFilter
          }
        });

        const totalMinutes = lineups.reduce((sum, l) => sum + l.minutesPlayed, 0);
        const totalGoals = stats.reduce((sum, s) => sum + s.goals, 0);
        const totalAssists = stats.reduce((sum, s) => sum + s.assists, 0);
        const totalYellowCards = stats.reduce((sum, s) => sum + s.yellowCards, 0);
        const totalRedCards = stats.filter(s => s.redCard).length;

        const matchesCalledUp = lineups.filter(l => l.isCalledUp).length;
        const matchesStarted = lineups.filter(l => l.status === 'titular').length;

        // Calculate total matches played by the player's clubs in the tournament
        let totalClubMatches = 0;
        const clubIds = Array.from(new Set(lineups.map(l => l.clubId)));

        if (clubIds.length > 0) {
          totalClubMatches = await prisma.match.count({
            where: {
              ...matchFilter,
              OR: [
                { homeClubId: { in: clubIds } },
                { awayClubId: { in: clubIds } }
              ]
            }
          });
        } else if (player.currentClubId) {
          totalClubMatches = await prisma.match.count({
            where: {
              ...matchFilter,
              OR: [
                { homeClubId: player.currentClubId },
                { awayClubId: player.currentClubId }
              ]
            }
          });
        }

        const titularityPercentage = totalClubMatches > 0
          ? Math.round((matchesStarted / totalClubMatches) * 100 * 100) / 100
          : 0;

        return res.json({
          player: {
            id: player.id,
            name: player.name,
            currentClub: player.currentClub ? { id: player.currentClub.id, name: player.currentClub.name } : null
          },
          stats: {
            totalMinutes,
            totalGoals,
            totalAssists,
            totalYellowCards,
            totalRedCards,
            matchesCalledUp,
            matchesStarted,
            totalClubMatches,
            titularityPercentage
          }
        });
      }

      // If no specific playerId is requested, return stats for all players
      const allPlayers = await prisma.player.findMany({
        include: {
          currentClub: true,
          lineups: {
            where: { match: matchFilter },
            include: { match: true }
          },
          stats: {
            where: { match: matchFilter }
          }
        }
      });

      const report = await Promise.all(allPlayers.map(async (player) => {
        const totalMinutes = player.lineups.reduce((sum, l) => sum + l.minutesPlayed, 0);
        const totalGoals = player.stats.reduce((sum, s) => sum + s.goals, 0);
        const totalAssists = player.stats.reduce((sum, s) => sum + s.assists, 0);
        const totalYellowCards = player.stats.reduce((sum, s) => sum + s.yellowCards, 0);
        const totalRedCards = player.stats.filter(s => s.redCard).length;

        const matchesCalledUp = player.lineups.filter(l => l.isCalledUp).length;
        const matchesStarted = player.lineups.filter(l => l.status === 'titular').length;

        let totalClubMatches = 0;
        const clubIds = Array.from(new Set(player.lineups.map(l => l.clubId)));

        if (clubIds.length > 0) {
          totalClubMatches = await prisma.match.count({
            where: {
              ...matchFilter,
              OR: [
                { homeClubId: { in: clubIds } },
                { awayClubId: { in: clubIds } }
              ]
            }
          });
        } else if (player.currentClubId) {
          totalClubMatches = await prisma.match.count({
            where: {
              ...matchFilter,
              OR: [
                { homeClubId: player.currentClubId },
                { awayClubId: player.currentClubId }
              ]
            }
          });
        }

        const titularityPercentage = totalClubMatches > 0
          ? Math.round((matchesStarted / totalClubMatches) * 100 * 100) / 100
          : 0;

        return {
          id: player.id,
          name: player.name,
          clubName: player.currentClub?.name || 'Free Agent',
          totalMinutes,
          totalGoals,
          totalAssists,
          totalYellowCards,
          totalRedCards,
          matchesStarted,
          titularityPercentage
        };
      }));

      // Sort by goals desc, then assists desc
      report.sort((a, b) => b.totalGoals - a.totalGoals || b.totalAssists - a.totalAssists);

      return res.json(report);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  /**
   * GET /api/reports/clubs?tournamentId=...
   * Generates a club report showing:
   * - Performance metrics (Matches played, Wins, Draws, Losses, Points)
   * - Goals For & Goals Against (calculated from players' goals)
   * - Tactical systems used.
   */
  static async getClubReport(req: Request, res: Response) {
    try {
      const { tournamentId } = req.query as { tournamentId?: string };

      // Base filter
      const matchFilter: any = {};
      if (tournamentId) {
        matchFilter.tournamentId = tournamentId;
      }

      // Fetch all matches with their lineups and stats
      const matches = await prisma.match.findMany({
        where: matchFilter,
        include: {
          lineups: true,
          stats: true
        }
      });

      // Fetch all clubs
      const clubs = await prisma.club.findMany();

      // Initialize report map
      const clubReportMap: Record<string, {
        id: string;
        name: string;
        tacticalSystem: string | null;
        matchesPlayed: number;
        wins: number;
        draws: number;
        losses: number;
        points: number;
        goalsFor: number;
        goalsAgainst: number;
      }> = {};

      clubs.forEach(club => {
        clubReportMap[club.id] = {
          id: club.id,
          name: club.name,
          tacticalSystem: club.tacticalSystem,
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0
        };
      });

      // Process each match to calculate goals and performance
      matches.forEach(match => {
        const homeId = match.homeClubId;
        const awayId = match.awayClubId;

        // Calculate goals for Home Club (sum of goals scored by home club players)
        // Home players are those in lineup belonging to home club
        const homePlayers = new Set(
          match.lineups.filter(l => l.clubId === homeId).map(l => l.playerId)
        );
        const awayPlayers = new Set(
          match.lineups.filter(l => l.clubId === awayId).map(l => l.playerId)
        );

        const homeGoals = match.stats
          .filter(s => homePlayers.has(s.playerId))
          .reduce((sum, s) => sum + s.goals, 0);

        const awayGoals = match.stats
          .filter(s => awayPlayers.has(s.playerId))
          .reduce((sum, s) => sum + s.goals, 0);

        // Update statistics for Home Club
        if (clubReportMap[homeId]) {
          const homeReport = clubReportMap[homeId];
          homeReport.matchesPlayed += 1;
          homeReport.goalsFor += homeGoals;
          homeReport.goalsAgainst += awayGoals;

          if (homeGoals > awayGoals) {
            homeReport.wins += 1;
            homeReport.points += 3;
          } else if (homeGoals === awayGoals) {
            homeReport.draws += 1;
            homeReport.points += 1;
          } else {
            homeReport.losses += 1;
          }
        }

        // Update statistics for Away Club
        if (clubReportMap[awayId]) {
          const awayReport = clubReportMap[awayId];
          awayReport.matchesPlayed += 1;
          awayReport.goalsFor += awayGoals;
          awayReport.goalsAgainst += homeGoals;

          if (awayGoals > homeGoals) {
            awayReport.wins += 1;
            awayReport.points += 3;
          } else if (awayGoals === homeGoals) {
            awayReport.draws += 1;
            awayReport.points += 1;
          } else {
            awayReport.losses += 1;
          }
        }
      });

      // Prepare list and sort by points desc, then goal difference desc, then goals for desc
      const clubReportsList = Object.values(clubReportMap);
      clubReportsList.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const aDiff = a.goalsFor - a.goalsAgainst;
        const bDiff = b.goalsFor - b.goalsAgainst;
        if (bDiff !== aDiff) return bDiff - aDiff;
        return b.goalsFor - a.goalsFor;
      });

      // Calculate distribution of tactical systems
      const tacticalSystemsDistribution: Record<string, number> = {};
      clubs.forEach(club => {
        const sys = club.tacticalSystem || 'Unknown';
        tacticalSystemsDistribution[sys] = (tacticalSystemsDistribution[sys] || 0) + 1;
      });

      return res.json({
        standings: clubReportsList,
        tacticalSystemsDistribution
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
}
