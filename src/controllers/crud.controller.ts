import { Request, Response } from 'express';
import prisma from '../config/prisma';

export class CrudController {
  // --- Tournaments ---
  static async createTournament(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });
      const item = await prisma.tournament.create({ data: { name } });
      return res.status(201).json(item);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  static async getTournaments(req: Request, res: Response) {
    try {
      const items = await prisma.tournament.findMany({ include: { _count: { select: { matches: true } } } });
      return res.json(items);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- Stadiums ---
  static async createStadium(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });
      const item = await prisma.stadium.create({ data: { name } });
      return res.status(201).json(item);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  static async getStadiums(req: Request, res: Response) {
    try {
      const items = await prisma.stadium.findMany();
      return res.json(items);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- Clubs ---
  static async createClub(req: Request, res: Response) {
    try {
      const { name, tacticalSystem, stadiumId } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      if (stadiumId) {
        const st = await prisma.stadium.findUnique({ where: { id: stadiumId } });
        if (!st) return res.status(404).json({ error: `Stadium ${stadiumId} not found` });
      }

      const item = await prisma.club.create({
        data: {
          name,
          tacticalSystem,
          stadiumId
        }
      });
      return res.status(201).json(item);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  static async getClubs(req: Request, res: Response) {
    try {
      const items = await prisma.club.findMany({
        include: {
          stadium: true,
          players: true
        }
      });
      return res.json(items);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- Players ---
  static async createPlayer(req: Request, res: Response) {
    try {
      const { name, currentClubId } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      if (currentClubId) {
        const club = await prisma.club.findUnique({ where: { id: currentClubId } });
        if (!club) return res.status(404).json({ error: `Club ${currentClubId} not found` });
      }

      const item = await prisma.player.create({
        data: {
          name,
          currentClubId
        }
      });
      return res.status(201).json(item);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  static async getPlayers(req: Request, res: Response) {
    try {
      const items = await prisma.player.findMany({
        include: {
          currentClub: true
        }
      });
      return res.json(items);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- Matches list/view ---
  static async getMatches(req: Request, res: Response) {
    try {
      const items = await prisma.match.findMany({
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
      return res.json(items);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  static async getMatchById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const item = await prisma.match.findUnique({
        where: { id },
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
      if (!item) return res.status(404).json({ error: 'Match not found' });
      return res.json(item);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
}
