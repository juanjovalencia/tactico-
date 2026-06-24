import { Request, Response, NextFunction } from 'express';
import { MatchService } from '../services/match.service';

export class MatchController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { tournamentId, matchday, date, homeClubId, awayClubId, stadiumId, lineups, stats } = req.body;

      // Validate required top-level fields
      if (!tournamentId || !matchday || !date || !homeClubId || !awayClubId || !stadiumId) {
        return res.status(400).json({
          error: 'Missing required match fields: tournamentId, matchday, date, homeClubId, awayClubId, stadiumId are required.'
        });
      }

      if (!Array.isArray(lineups) || !Array.isArray(stats)) {
        return res.status(400).json({
          error: 'lineups and stats must be arrays.'
        });
      }

      const match = await MatchService.registerMatch({
        tournamentId,
        matchday,
        date,
        homeClubId,
        awayClubId,
        stadiumId,
        lineups,
        stats
      });

      return res.status(201).json({
        message: 'Match, lineup and statistics registered successfully',
        data: match
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message || 'An error occurred while registering the match'
      });
    }
  }
}
