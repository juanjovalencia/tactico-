import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { CrudController } from './controllers/crud.controller';
import { MatchController } from './controllers/match.controller';
import { ReportController } from './controllers/report.controller';
import { AuthController } from './controllers/auth.controller';
import { ActivityController } from './controllers/activity.controller';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Hello/Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ─── AUTH ────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', AuthController.login);
app.get('/api/auth/me', AuthController.getMe);
app.post('/api/auth/logout', AuthController.logout);
app.post('/api/auth/heartbeat', AuthController.heartbeat);

// ─── ACTIVITY (admin only in practice) ──────────────────────────────────────
app.get('/api/activity', ActivityController.getActivity);
app.post('/api/activity', ActivityController.postActivity);
app.get('/api/activity/stats', ActivityController.getUserStats);

// ─── CRUD - Tournaments ──────────────────────────────────────────────────────
app.post('/api/tournaments', CrudController.createTournament);
app.get('/api/tournaments', CrudController.getTournaments);

// ─── CRUD - Stadiums ─────────────────────────────────────────────────────────
app.post('/api/stadiums', CrudController.createStadium);
app.get('/api/stadiums', CrudController.getStadiums);

// ─── CRUD - Clubs ────────────────────────────────────────────────────────────
app.post('/api/clubs', CrudController.createClub);
app.get('/api/clubs', CrudController.getClubs);

// ─── CRUD - Players ──────────────────────────────────────────────────────────
app.post('/api/players', CrudController.createPlayer);
app.get('/api/players', CrudController.getPlayers);

// ─── CRUD - Matches ──────────────────────────────────────────────────────────
app.get('/api/matches', CrudController.getMatches);
app.get('/api/matches/:id', CrudController.getMatchById);

// ─── Match Registration ──────────────────────────────────────────────────────
app.post('/api/matches/register', MatchController.register);

// ─── Reports ─────────────────────────────────────────────────────────────────
app.get('/api/reports/players', ReportController.getPlayerReport);
app.get('/api/reports/clubs', ReportController.getClubReport);

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error'
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`⚽ Football Scouting API running on http://localhost:${PORT}`);
  });
}

export default app;
