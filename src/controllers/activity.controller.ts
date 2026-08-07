import { Request, Response } from 'express';
import { AuthController } from './auth.controller';

export interface ActivityEntry {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  action: string;        // 'upload_planilla' | 'login' | 'logout'
  detail: string;        // e.g. "Partido #5 - Colo Colo vs U de Chile"
  matchId?: string;
  timestamp: Date;
}

// In-memory activity log
const activityLog: ActivityEntry[] = [];
let activityCounter = 0;

export class ActivityController {
  static addActivity(entry: Omit<ActivityEntry, 'id' | 'timestamp'>) {
    activityCounter++;
    const newEntry: ActivityEntry = {
      ...entry,
      id: `act_${activityCounter}`,
      timestamp: new Date(),
    };
    activityLog.unshift(newEntry); // newest first
    if (activityLog.length > 500) activityLog.pop(); // cap log size
    return newEntry;
  }

  static getActivity(req: Request, res: Response) {
    const limit = parseInt(req.query.limit as string) || 50;
    return res.json(activityLog.slice(0, limit));
  }

  static postActivity(req: Request, res: Response) {
    const { userId, username, displayName, action, detail, matchId } = req.body;
    if (!userId || !action) {
      return res.status(400).json({ error: 'userId y action son requeridos' });
    }
    const entry = ActivityController.addActivity({ userId, username, displayName, action, detail, matchId });
    return res.json(entry);
  }

  static getUserStats(req: Request, res: Response) {
    const users = AuthController.getAllUsers();
    const sessions = AuthController.getActiveSessions();
    const now = new Date();
    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    // Build stats per user
    const stats = users.map((user) => {
      const userActivity = activityLog.filter((a) => a.userId === user.id);
      const uploads = userActivity.filter((a) => a.action === 'upload_planilla');

      // Check if online (has a session with recent heartbeat)
      let isOnline = false;
      let lastSeen: Date | null = null;
      sessions.forEach((session) => {
        if (session.userId === user.id) {
          const diff = now.getTime() - session.lastSeen.getTime();
          if (diff < ONLINE_THRESHOLD_MS) isOnline = true;
          if (!lastSeen || session.lastSeen > lastSeen) lastSeen = session.lastSeen;
        }
      });

      return {
        user,
        totalUploads: uploads.length,
        lastUpload: uploads[0]?.timestamp || null,
        lastSeen,
        isOnline,
        recentActivity: userActivity.slice(0, 5),
      };
    });

    return res.json(stats);
  }

  static logUpload(userId: string, username: string, displayName: string, detail: string, matchId?: string) {
    return ActivityController.addActivity({
      userId,
      username,
      displayName,
      action: 'upload_planilla',
      detail,
      matchId,
    });
  }
}
