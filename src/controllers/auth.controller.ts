import { Request, Response } from 'express';
import crypto from 'crypto';

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'analyst';
  avatar: string;
}

const USERS: Array<AppUser & { password: string }> = [
  {
    id: 'usr_tactico',
    username: 'tactico',
    displayName: 'Táctico Admin',
    role: 'admin',
    avatar: '🎯',
    password: '123',
  },
  {
    id: 'usr_scouter1',
    username: 'scouter1',
    displayName: 'Carlos Mendoza',
    role: 'analyst',
    avatar: '📊',
    password: '123',
  },
  {
    id: 'usr_scouter2',
    username: 'scouter2',
    displayName: 'Diego Fuentes',
    role: 'analyst',
    avatar: '⚽',
    password: '123',
  },
  {
    id: 'usr_scouter3',
    username: 'scouter3',
    displayName: 'Andrés Silva',
    role: 'analyst',
    avatar: '📋',
    password: '123',
  },
  {
    id: 'usr_scouter4',
    username: 'scouter4',
    displayName: 'Felipe Torres',
    role: 'analyst',
    avatar: '🔍',
    password: '123',
  },
];

// In-memory sessions
const sessions: Map<string, { userId: string; lastSeen: Date }> = new Map();

export class AuthController {
  static login(req: Request, res: Response) {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const user = USERS.find(
      (u) => u.username === username.toLowerCase() && u.password === password
    );

    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, lastSeen: new Date() });

    const { password: _pwd, ...safeUser } = user;
    return res.json({ user: safeUser, token });
  }

  static getMe(req: Request, res: Response) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token || !sessions.has(token)) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const session = sessions.get(token)!;
    session.lastSeen = new Date();

    const user = USERS.find((u) => u.id === session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const { password: _pwd, ...safeUser } = user;
    return res.json(safeUser);
  }

  static heartbeat(req: Request, res: Response) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token && sessions.has(token)) {
      sessions.get(token)!.lastSeen = new Date();
    }
    return res.json({ ok: true });
  }

  static getActiveSessions() {
    return sessions;
  }

  static getAllUsers(): AppUser[] {
    return USERS.map(({ password: _pwd, ...u }) => u);
  }

  static logout(req: Request, res: Response) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) sessions.delete(token);
    return res.json({ ok: true });
  }
}
