import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Users, 
  Shield, 
  FileText, 
  Plus, 
  UserPlus, 
  Calendar, 
  MapPin, 
  Activity, 
  ChevronRight, 
  Check, 
  AlertCircle, 
  TrendingUp, 
  RefreshCw, 
  Sparkles,
  Award,
  ChevronDown,
  LogOut
} from 'lucide-react';
import LoginPage from './LoginPage';
import AdminDashboard from './AdminDashboard';

interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'analyst';
  avatar: string;
}

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : 'https://tactico-backend-jj.loca.lt/api';

// Interfaces
interface Tournament { id: string; name: string; _count?: { matches: number } }
interface Stadium { id: string; name: string }
interface Club { id: string; name: string; tacticalSystem: string | null; stadium: Stadium | null; stadiumId?: string }
interface Player { id: string; name: string; currentClubId: string | null; currentClub?: Club | null }
interface Match { 
  id: string; 
  tournamentId: string; 
  tournament: Tournament; 
  matchday: number; 
  date: string; 
  homeClubId: string; 
  homeClub: Club; 
  awayClubId: string; 
  awayClub: Club; 
  stadiumId: string; 
  stadium: Stadium;
  lineups?: any[];
  stats?: any[];
}

export default function App() {
  // Auth state — restore from localStorage on mount
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem('tactico_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [authToken, setAuthToken] = useState<string>(() => localStorage.getItem('tactico_token') || '');

  const [activeTab, setActiveTab] = useState<'dashboard' | 'crud' | 'planilla' | 'reportes' | 'admin'>('dashboard');
  const [crudSubTab, setCrudSubTab] = useState<'tournaments' | 'stadiums' | 'clubs' | 'players' | 'matches'>('tournaments');
  const [reportSubTab, setReportSubTab] = useState<'players' | 'clubs'>('players');

  // Database Data States
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  // Selection & Form States
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string>(''); // For loading lineup of a specific club in match sheet
  
  // Lineup and Stats Editing States for Match Sheet
  const [lineupRows, setLineupRows] = useState<Record<string, {
    isCalledUp: boolean;
    status: 'titular' | 'suplente' | 'no_jugo';
    isSubstituted: boolean;
    substitutedById: string;
    substitutionMinute: number;
    goals: number;
    assists: number;
    yellowCards: number;
    redCard: boolean;
  }>>({});

  // CRUD Forms States
  const [newTournamentName, setNewTournamentName] = useState('');
  const [newStadiumName, setNewStadiumName] = useState('');
  const [newClub, setNewClub] = useState({ name: '', tacticalSystem: '4-3-3', stadiumId: '' });
  const [newPlayer, setNewPlayer] = useState({ name: '', currentClubId: '' });
  const [newMatch, setNewMatch] = useState({ tournamentId: '', matchday: 1, date: '', homeClubId: '', awayClubId: '', stadiumId: '' });

  // Report States
  const [playerReport, setPlayerReport] = useState<any[]>([]);
  const [clubReport, setClubReport] = useState<any>({ standings: [], tacticalSystemsDistribution: {} });
  const [filterPlayerName, setFilterPlayerName] = useState('');

  // Status/Alert messages
  const [alert, setAlert] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Auth handlers
  const handleLogin = (user: AppUser, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    // Auto-navigate admin to admin tab
    if (user.role === 'admin') setActiveTab('admin');
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
    } catch { /* ignore */ }
    localStorage.removeItem('tactico_token');
    localStorage.removeItem('tactico_user');
    setCurrentUser(null);
    setAuthToken('');
    setActiveTab('dashboard');
  };

  // Heartbeat — tells server this user is still online
  useEffect(() => {
    if (!authToken) return;
    const sendHeartbeat = () => {
      fetch(`${API_BASE}/auth/heartbeat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [authToken]);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [resT, resS, resC, resP, resM] = await Promise.all([
        fetch(`${API_BASE}/tournaments`),
        fetch(`${API_BASE}/stadiums`),
        fetch(`${API_BASE}/clubs`),
        fetch(`${API_BASE}/players`),
        fetch(`${API_BASE}/matches`)
      ]);

      const t = await resT.json();
      const s = await resS.json();
      const c = await resC.json();
      const p = await resP.json();
      const m = await resM.json();

      setTournaments(t);
      setStadiums(s);
      setClubs(c);
      setPlayers(p);
      setMatches(m);

      if (t.length > 0 && !selectedTournamentId) {
        setSelectedTournamentId(t[0].id);
      }
      if (m.length > 0 && !selectedMatchId) {
        setSelectedMatchId(m[0].id);
      }
    } catch (error) {
      showMsg('error', 'Error conectando con el servidor. Revisa que el backend esté corriendo.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch Reports when tournament filter changes
  useEffect(() => {
    if (activeTab === 'reportes') {
      fetchReports();
    }
  }, [selectedTournamentId, activeTab, reportSubTab]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const query = selectedTournamentId ? `?tournamentId=${selectedTournamentId}` : '';
      if (reportSubTab === 'players') {
        const res = await fetch(`${API_BASE}/reports/players${query}`);
        const data = await res.json();
        setPlayerReport(Array.isArray(data) ? data : []);
      } else {
        const res = await fetch(`${API_BASE}/reports/clubs${query}`);
        const data = await res.json();
        setClubReport(data);
      }
    } catch (e) {
      showMsg('error', 'Error al obtener reportes.');
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setAlert({ type, text });
    setTimeout(() => setAlert(null), 5000);
  };

  // --- CRUD Handlers ---
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTournamentName) return;
    try {
      const res = await fetch(`${API_BASE}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTournamentName })
      });
      if (res.ok) {
        showMsg('success', 'Torneo creado con éxito');
        setNewTournamentName('');
        fetchData();
      } else {
        const err = await res.json();
        showMsg('error', err.error || 'Error creando torneo');
      }
    } catch (e) {
      showMsg('error', 'Error en el servidor');
    }
  };

  const handleCreateStadium = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStadiumName) return;
    try {
      const res = await fetch(`${API_BASE}/stadiums`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStadiumName })
      });
      if (res.ok) {
        showMsg('success', 'Estadio creado con éxito');
        setNewStadiumName('');
        fetchData();
      } else {
        const err = await res.json();
        showMsg('error', err.error);
      }
    } catch (e) {
      showMsg('error', 'Error en el servidor');
    }
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClub.name) return;
    try {
      const res = await fetch(`${API_BASE}/clubs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClub)
      });
      if (res.ok) {
        showMsg('success', 'Club creado con éxito');
        setNewClub({ name: '', tacticalSystem: '4-3-3', stadiumId: '' });
        fetchData();
      } else {
        const err = await res.json();
        showMsg('error', err.error);
      }
    } catch (e) {
      showMsg('error', 'Error en el servidor');
    }
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayer.name) return;
    try {
      const res = await fetch(`${API_BASE}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlayer.name,
          currentClubId: newPlayer.currentClubId || null
        })
      });
      if (res.ok) {
        showMsg('success', 'Jugador enrolado con éxito');
        setNewPlayer({ name: '', currentClubId: '' });
        fetchData();
      } else {
        const err = await res.json();
        showMsg('error', err.error);
      }
    } catch (e) {
      showMsg('error', 'Error en el servidor');
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const { tournamentId, matchday, date, homeClubId, awayClubId, stadiumId } = newMatch;
    if (!tournamentId || !homeClubId || !awayClubId || !stadiumId || !date) {
      showMsg('error', 'Por favor llena todos los campos del partido');
      return;
    }
    if (homeClubId === awayClubId) {
      showMsg('error', 'El club local y visitante no pueden ser el mismo');
      return;
    }
    try {
      // Find stadium of home club if stadiumId is not selected, or use selected
      const res = await fetch(`${API_BASE}/matches/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          matchday: Number(matchday),
          date: new Date(date).toISOString(),
          homeClubId,
          awayClubId,
          stadiumId,
          lineups: [], // Empty initially
          stats: [] // Empty initially
        })
      });
      if (res.ok) {
        showMsg('success', 'Partido creado con éxito. Ahora puedes cargar su planilla.');
        setNewMatch({ tournamentId: '', matchday: 1, date: '', homeClubId: '', awayClubId: '', stadiumId: '' });
        fetchData();
        setActiveTab('planilla');
      } else {
        const err = await res.json();
        showMsg('error', err.error);
      }
    } catch (e) {
      showMsg('error', 'Error de conexión');
    }
  };

  // --- Match Planilla Loading ---
  const loadMatchForPlanilla = async (matchId: string) => {
    if (!matchId) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/matches/${matchId}`);
      const m: Match = await res.json();
      setSelectedMatch(m);
      
      // Default selected club to home club
      setSelectedClubId(m.homeClubId);
    } catch (e) {
      showMsg('error', 'Error cargando partido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'planilla' && selectedMatchId) {
      loadMatchForPlanilla(selectedMatchId);
    }
  }, [selectedMatchId, activeTab]);

  // Set up the lineup rows when selectedMatch or selectedClub changes
  useEffect(() => {
    if (!selectedMatch || !selectedClubId) return;

    // Filter players belonging to selected club
    const clubPlayers = players.filter(p => p.currentClubId === selectedClubId);
    
    // Check if there's already saved lineups for this match and club in the db
    const existingLineups = selectedMatch.lineups?.filter(l => l.clubId === selectedClubId) || [];
    const existingStats = selectedMatch.stats || [];

    const newRows: Record<string, any> = {};

    clubPlayers.forEach(player => {
      const savedL = existingLineups.find(l => l.playerId === player.id);
      const savedS = existingStats.find(s => s.playerId === player.id);

      newRows[player.id] = {
        isCalledUp: savedL ? savedL.isCalledUp : true,
        status: savedL ? savedL.status : 'no_jugo',
        isSubstituted: savedL ? savedL.isSubstituted : false,
        substitutedById: savedL ? savedL.substitutedById || '' : '',
        substitutionMinute: savedL ? savedL.substitutionMinute || 45 : 45,
        goals: savedS ? savedS.goals : 0,
        assists: savedS ? savedS.assists : 0,
        yellowCards: savedS ? savedS.yellowCards : 0,
        redCard: savedS ? savedS.redCard : false,
      };
    });

    setLineupRows(newRows);
  }, [selectedMatch, selectedClubId, players]);

  const updateRow = (playerId: string, field: string, value: any) => {
    setLineupRows(prev => {
      const updatedRow = { ...prev[playerId], [field]: value };
      
      // Auto-validate yellow/red card consistency
      if (field === 'yellowCards') {
        const yCards = Number(value);
        if (yCards >= 2) {
          updatedRow.redCard = true;
        } else if (yCards < 2 && prev[playerId].yellowCards >= 2) {
          updatedRow.redCard = false;
        }
      }

      // Enforce status constraints: If status is 'no_jugo', clean substitutions & stats
      if (field === 'status' && value === 'no_jugo') {
        updatedRow.isSubstituted = false;
        updatedRow.substitutedById = '';
        updatedRow.goals = 0;
        updatedRow.assists = 0;
        updatedRow.yellowCards = 0;
        updatedRow.redCard = false;
      }

      // If isSubstituted becomes false, clean substitution properties
      if (field === 'isSubstituted' && value === false) {
        updatedRow.substitutedById = '';
      }

      return {
        ...prev,
        [playerId]: updatedRow
      };
    });
  };

  const handleRegisterPlanilla = async () => {
    if (!selectedMatch) return;
    setLoading(true);

    try {
      // 1. Gather all lineup entries for the selected club
      const lineupsPayload = Object.entries(lineupRows).map(([playerId, row]) => ({
        playerId,
        clubId: selectedClubId,
        isCalledUp: row.isCalledUp,
        status: row.status,
        isSubstituted: row.isSubstituted,
        substitutedById: row.isSubstituted && row.substitutedById ? row.substitutedById : null,
        substitutionMinute: row.isSubstituted ? Number(row.substitutionMinute) : null
      }));

      // Gather other club's lineups to not overwrite/delete them
      const otherClubId = selectedClubId === selectedMatch.homeClubId ? selectedMatch.awayClubId : selectedMatch.homeClubId;
      const otherClubLineups = selectedMatch.lineups?.filter(l => l.clubId === otherClubId).map(l => ({
        playerId: l.playerId,
        clubId: l.clubId,
        isCalledUp: l.isCalledUp,
        status: l.status,
        isSubstituted: l.isSubstituted,
        substitutedById: l.substitutedById,
        substitutionMinute: l.substitutionMinute
      })) || [];

      // Combine both lineups
      const finalLineups = [...lineupsPayload, ...otherClubLineups];

      // 2. Gather stats entries for selected club
      const statsPayload = Object.entries(lineupRows)
        .filter(([_, row]) => row.isCalledUp && row.status !== 'no_jugo')
        .map(([playerId, row]) => ({
          playerId,
          goals: Number(row.goals),
          assists: Number(row.assists),
          yellowCards: Number(row.yellowCards),
          redCard: row.redCard
        }));

      // Gather other club's stats to keep them
      const otherClubPlayerIds = new Set(players.filter(p => p.currentClubId === otherClubId).map(p => p.id));
      const otherClubStats = selectedMatch.stats?.filter(s => otherClubPlayerIds.has(s.playerId)).map(s => ({
        playerId: s.playerId,
        goals: s.goals,
        assists: s.assists,
        yellowCards: s.yellowCards,
        redCard: s.redCard
      })) || [];

      // Combine stats
      const finalStats = [...statsPayload, ...otherClubStats];

      // Send to backend
      const res = await fetch(`${API_BASE}/matches/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedMatch.tournamentId,
          matchday: selectedMatch.matchday,
          date: selectedMatch.date,
          homeClubId: selectedMatch.homeClubId,
          awayClubId: selectedMatch.awayClubId,
          stadiumId: selectedMatch.stadiumId,
          lineups: finalLineups,
          stats: finalStats
        })
      });

      if (res.ok) {
        showMsg('success', 'Planilla y estadísticas guardadas con éxito (Consistencia validada)');
        // Log activity for admin tracking
        if (currentUser && selectedMatch) {
          const matchLabel = `${selectedMatch.homeClub?.name || 'Local'} vs ${selectedMatch.awayClub?.name || 'Visita'} (J${selectedMatch.matchday})`;
          fetch(`${API_BASE}/activity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({
              userId: currentUser.id,
              username: currentUser.username,
              displayName: currentUser.displayName,
              action: 'upload_planilla',
              detail: matchLabel,
              matchId: selectedMatch.id
            })
          }).catch(() => {});
        }
        // Reload match to reflect calculated minutes and new status
        loadMatchForPlanilla(selectedMatch.id);
      } else {
        const err = await res.json();
        showMsg('error', err.error || 'Error al guardar planilla');
      }
    } catch (e: any) {
      showMsg('error', 'Error de red: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Show login if not authenticated
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-gray-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      
      {/* Premium Header */}
      <header className="border-b border-gray-800 bg-[#0c1220]/80 backdrop-blur-xl sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Trophy className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-100 to-brand-400">
                TACTICO
              </h1>
              <p className="text-xs text-brand-400 font-medium tracking-widest uppercase">Analytics & Management</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-[#121b2d] p-1.5 rounded-xl border border-gray-800">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800/40'}`}>
              Tablero
            </button>
            <button 
              onClick={() => setActiveTab('crud')}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'crud' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800/40'}`}>
              Enrolamiento (CRUD)
            </button>
            <button 
              onClick={() => setActiveTab('planilla')}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'planilla' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800/40'}`}>
              Planilla de Partido
            </button>
            <button 
              onClick={() => setActiveTab('reportes')}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'reportes' ? 'bg-brand-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800/40'}`}>
              Reportes
            </button>
            {currentUser.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'admin' ? 'bg-amber-600 text-white shadow-md' : 'text-amber-400 hover:text-white hover:bg-amber-800/40'}`}>
                ⚡ Admin
              </button>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {/* Logged-in user pill */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#121b2d] border border-gray-800">
              <span className="text-base">{currentUser.avatar}</span>
              <div>
                <p className="text-xs font-bold text-white leading-tight">{currentUser.displayName}</p>
                <p className="text-xs text-gray-500 leading-tight">{currentUser.role === 'admin' ? '🎯 Admin' : 'Analista'}</p>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Live
            </div>
            <button onClick={fetchData} className="p-2.5 rounded-xl border border-gray-800 bg-[#121b2d] hover:bg-gray-800 text-gray-400 hover:text-white transition-colors duration-200">
              <RefreshCw className={`h-4.5 w-4.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleLogout} title="Cerrar sesión" className="p-2.5 rounded-xl border border-gray-800 bg-[#121b2d] hover:bg-rose-900/40 hover:border-rose-700 text-gray-400 hover:text-rose-400 transition-colors duration-200">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Navigation */}
        <div className="md:hidden flex border-t border-gray-800 bg-[#0c1220]">
          <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-4 text-xs font-bold text-center border-b-2 ${activeTab === 'dashboard' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400'}`}>Tablero</button>
          <button onClick={() => setActiveTab('crud')} className={`flex-1 py-4 text-xs font-bold text-center border-b-2 ${activeTab === 'crud' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400'}`}>Enrolamiento</button>
          <button onClick={() => setActiveTab('planilla')} className={`flex-1 py-4 text-xs font-bold text-center border-b-2 ${activeTab === 'planilla' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400'}`}>Planillas</button>
          <button onClick={() => setActiveTab('reportes')} className={`flex-1 py-4 text-xs font-bold text-center border-b-2 ${activeTab === 'reportes' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400'}`}>Reportes</button>
        </div>
      </header>

      {/* Floating Notifications */}
      {alert && (
        <div className={`fixed top-24 right-4 z-50 max-w-md p-4 rounded-xl shadow-2xl border flex items-start gap-3 transform translate-y-0 transition-transform duration-300 ${alert.type === 'success' ? 'bg-[#0f2e22]/90 border-emerald-500/30 text-emerald-300' : 'bg-[#361313]/90 border-rose-500/30 text-rose-300'}`}>
          {alert.type === 'success' ? <Check className="h-5 w-5 mt-0.5 shrink-0" /> : <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />}
          <div>
            <p className="font-bold text-sm">{alert.type === 'success' ? 'Éxito' : 'Error en Validación'}</p>
            <p className="text-xs opacity-90 mt-0.5">{alert.text}</p>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ==================== TAB: DASHBOARD ==================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-[#0e1726]/60 border border-gray-800 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Torneos</p>
                  <p className="text-3xl font-extrabold mt-1 text-white">{tournaments.length}</p>
                </div>
                <Trophy className="h-10 w-10 text-amber-500/20" />
              </div>
              <div className="bg-[#0e1726]/60 border border-gray-800 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Clubes</p>
                  <p className="text-3xl font-extrabold mt-1 text-white">{clubs.length}</p>
                </div>
                <Shield className="h-10 w-10 text-brand-500/20" />
              </div>
              <div className="bg-[#0e1726]/60 border border-gray-800 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Jugadores</p>
                  <p className="text-3xl font-extrabold mt-1 text-white">{players.length}</p>
                </div>
                <Users className="h-10 w-10 text-blue-500/20" />
              </div>
              <div className="bg-[#0e1726]/60 border border-gray-800 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Estadios</p>
                  <p className="text-3xl font-extrabold mt-1 text-white">{stadiums.length}</p>
                </div>
                <MapPin className="h-10 w-10 text-red-500/20" />
              </div>
              <div className="col-span-2 lg:col-span-1 bg-[#0e1726]/60 border border-gray-800 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Partidos</p>
                  <p className="text-3xl font-extrabold mt-1 text-white">{matches.length}</p>
                </div>
                <Calendar className="h-10 w-10 text-emerald-500/20" />
              </div>
            </div>

            {/* Live Seeding Notification Info */}
            <div className="p-6 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/20 to-indigo-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-400 animate-spin" /> Base de Datos Autopoblada
                </h4>
                <p className="text-sm text-gray-300 mt-1">
                  Hemos cargado datos iniciales correspondientes a la <strong>Super Liga 2026</strong>. Ya existen clubes como el <em>Real Madrid F.C.</em> y <em>Barcelona F.C.</em> con plantillas de jugadores listas para probar.
                </p>
              </div>
              <button 
                onClick={() => setActiveTab('planilla')}
                className="shrink-0 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-brand-600/20 transition-all duration-200 flex items-center gap-1.5">
                Cargar Planilla Ahora <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Matches & Seeded Teams */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left: Recent Matches */}
              <div className="lg:col-span-2 bg-[#0e1726]/40 border border-gray-800 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-brand-500" /> Partidos Registrados
                  </h3>
                  <button onClick={() => { setActiveTab('crud'); setCrudSubTab('matches'); }} className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-0.5">
                    Crear Partido <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {matches.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl">
                    <Calendar className="h-12 w-12 mx-auto text-gray-600 mb-3" />
                    <p className="text-sm">No hay partidos registrados aún.</p>
                    <p className="text-xs text-gray-600 mt-1">Crea uno en la sección de Enrolamiento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matches.map((match) => (
                      <div key={match.id} className="bg-[#121b2d]/60 border border-gray-800 p-5 rounded-xl space-y-4 hover:border-gray-700 transition-all duration-200">
                        <div className="flex items-center justify-between text-xs text-gray-400 font-semibold border-b border-gray-800 pb-2">
                          <span className="bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded">Jornada {match.matchday}</span>
                          <span>{new Date(match.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center justify-between font-bold text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-white">{match.homeClub.name}</span>
                          </div>
                          <span className="text-brand-400">vs</span>
                          <div className="flex items-center gap-2 text-right">
                            <span className="text-white">{match.awayClub.name}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-gray-500" /> {match.stadium.name}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedMatchId(match.id);
                            setActiveTab('planilla');
                          }}
                          className="w-full text-center py-2 bg-brand-500/10 text-brand-400 text-xs font-bold rounded-lg border border-brand-500/20 hover:bg-brand-600 hover:text-white transition-all duration-200">
                          Gestionar Planilla / Estadísticas
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Club Tactical distribution summary */}
              <div className="bg-[#0e1726]/40 border border-gray-800 rounded-2xl p-6 space-y-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-brand-500" /> Clubes y Sistemas
                </h3>

                {clubs.length === 0 ? (
                  <p className="text-xs text-gray-500 py-6 text-center">No hay clubes registrados.</p>
                ) : (
                  <div className="space-y-3">
                    {clubs.map(club => (
                      <div key={club.id} className="flex items-center justify-between p-3 rounded-xl bg-[#121b2d]/40 border border-gray-800">
                        <div>
                          <p className="text-sm font-bold text-white">{club.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{club.stadium?.name || 'Sin Estadio'}</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 bg-gray-800 text-brand-400 rounded-lg border border-gray-700">
                          {club.tacticalSystem || '4-3-3'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


        {/* ==================== TAB: CRUD ==================== */}
        {activeTab === 'crud' && (
          <div className="space-y-8 animate-fadeIn">
            {/* CRUD Sub-tabs */}
            <div className="flex border-b border-gray-800 gap-6">
              <button onClick={() => setCrudSubTab('tournaments')} className={`pb-3 font-bold text-sm border-b-2 transition-all duration-200 ${crudSubTab === 'tournaments' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400 hover:text-white'}`}>Torneos</button>
              <button onClick={() => setCrudSubTab('stadiums')} className={`pb-3 font-bold text-sm border-b-2 transition-all duration-200 ${crudSubTab === 'stadiums' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400 hover:text-white'}`}>Estadios</button>
              <button onClick={() => setCrudSubTab('clubs')} className={`pb-3 font-bold text-sm border-b-2 transition-all duration-200 ${crudSubTab === 'clubs' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400 hover:text-white'}`}>Clubes</button>
              <button onClick={() => setCrudSubTab('players')} className={`pb-3 font-bold text-sm border-b-2 transition-all duration-200 ${crudSubTab === 'players' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400 hover:text-white'}`}>Jugadores</button>
              <button onClick={() => setCrudSubTab('matches')} className={`pb-3 font-bold text-sm border-b-2 transition-all duration-200 ${crudSubTab === 'matches' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400 hover:text-white'}`}>Partidos</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Left Column: Form */}
              <div className="bg-[#0e1726]/40 border border-gray-800 p-6 rounded-2xl">
                
                {/* 1. Form: Tournaments */}
                {crudSubTab === 'tournaments' && (
                  <form onSubmit={handleCreateTournament} className="space-y-4">
                    <h3 className="text-base font-bold text-white mb-2">Crear Nuevo Torneo</h3>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1.5">Nombre del Torneo</label>
                      <input 
                        type="text" 
                        value={newTournamentName} 
                        onChange={(e) => setNewTournamentName(e.target.value)} 
                        placeholder="Ej: Copa Chile 2026" 
                        className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>
                    <button type="submit" className="w-full bg-brand-600 hover:bg-brand-500 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors">
                      <Plus className="h-4.5 w-4.5" /> Agregar Torneo
                    </button>
                  </form>
                )}

                {/* 2. Form: Stadiums */}
                {crudSubTab === 'stadiums' && (
                  <form onSubmit={handleCreateStadium} className="space-y-4">
                    <h3 className="text-base font-bold text-white mb-2">Crear Nuevo Estadio</h3>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1.5">Nombre del Estadio</label>
                      <input 
                        type="text" 
                        value={newStadiumName} 
                        onChange={(e) => setNewStadiumName(e.target.value)} 
                        placeholder="Ej: Estadio San Carlos" 
                        className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>
                    <button type="submit" className="w-full bg-brand-600 hover:bg-brand-500 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors">
                      <Plus className="h-4.5 w-4.5" /> Agregar Estadio
                    </button>
                  </form>
                )}

                {/* 3. Form: Clubs */}
                {crudSubTab === 'clubs' && (
                  <form onSubmit={handleCreateClub} className="space-y-4">
                    <h3 className="text-base font-bold text-white mb-2">Crear Nuevo Club</h3>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1.5">Nombre del Club</label>
                      <input 
                        type="text" 
                        value={newClub.name} 
                        onChange={(e) => setNewClub({ ...newClub, name: e.target.value })} 
                        placeholder="Ej: Colo Colo" 
                        className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors mb-3"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1.5">Estadio Asociado</label>
                      <select 
                        value={newClub.stadiumId}
                        onChange={(e) => setNewClub({ ...newClub, stadiumId: e.target.value })}
                        className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors mb-3">
                        <option value="">Selecciona Estadio</option>
                        {stadiums.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1.5">Sistema Táctico por Defecto</label>
                      <select 
                        value={newClub.tacticalSystem}
                        onChange={(e) => setNewClub({ ...newClub, tacticalSystem: e.target.value })}
                        className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors">
                        <option value="4-3-3">4-3-3</option>
                        <option value="4-4-2">4-4-2</option>
                        <option value="3-5-2">3-5-2</option>
                        <option value="3-4-3">3-4-3</option>
                        <option value="4-2-3-1">4-2-3-1</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full bg-brand-600 hover:bg-brand-500 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors">
                      <Plus className="h-4.5 w-4.5" /> Agregar Club
                    </button>
                  </form>
                )}

                {/* 4. Form: Players */}
                {crudSubTab === 'players' && (
                  <form onSubmit={handleCreatePlayer} className="space-y-4">
                    <h3 className="text-base font-bold text-white mb-2">Enrolar Jugador</h3>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1.5">Nombre Completo</label>
                      <input 
                        type="text" 
                        value={newPlayer.name} 
                        onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })} 
                        placeholder="Ej: Alexis Sánchez" 
                        className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors mb-3"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1.5">Club Actual (Opcional)</label>
                      <select 
                        value={newPlayer.currentClubId}
                        onChange={(e) => setNewPlayer({ ...newPlayer, currentClubId: e.target.value })}
                        className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors">
                        <option value="">Ninguno (Agente Libre)</option>
                        {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <button type="submit" className="w-full bg-brand-600 hover:bg-brand-500 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors">
                      <UserPlus className="h-4.5 w-4.5" /> Enrolar Jugador
                    </button>
                  </form>
                )}

                {/* 5. Form: Matches */}
                {crudSubTab === 'matches' && (
                  <form onSubmit={handleCreateMatch} className="space-y-4">
                    <h3 className="text-base font-bold text-white mb-2">Crear Partido</h3>
                    
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1.5">Torneo</label>
                      <select 
                        value={newMatch.tournamentId}
                        onChange={(e) => setNewMatch({ ...newMatch, tournamentId: e.target.value })}
                        className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors">
                        <option value="">Selecciona Torneo</option>
                        {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-400 block mb-1.5">Jornada</label>
                        <input 
                          type="number" 
                          min={1}
                          value={newMatch.matchday} 
                          onChange={(e) => setNewMatch({ ...newMatch, matchday: Number(e.target.value) })} 
                          className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-400 block mb-1.5">Fecha y Hora</label>
                        <input 
                          type="datetime-local" 
                          value={newMatch.date} 
                          onChange={(e) => setNewMatch({ ...newMatch, date: e.target.value })} 
                          className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1.5">Club Local</label>
                      <select 
                        value={newMatch.homeClubId}
                        onChange={(e) => setNewMatch({ ...newMatch, homeClubId: e.target.value })}
                        className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors">
                        <option value="">Selecciona Local</option>
                        {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1.5">Club Visitante</label>
                      <select 
                        value={newMatch.awayClubId}
                        onChange={(e) => setNewMatch({ ...newMatch, awayClubId: e.target.value })}
                        className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors">
                        <option value="">Selecciona Visitante</option>
                        {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1.5">Estadio</label>
                      <select 
                        value={newMatch.stadiumId}
                        onChange={(e) => setNewMatch({ ...newMatch, stadiumId: e.target.value })}
                        className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors">
                        <option value="">Selecciona Estadio</option>
                        {stadiums.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>

                    <button type="submit" className="w-full bg-brand-600 hover:bg-brand-500 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors">
                      <Calendar className="h-4.5 w-4.5" /> Crear Partido
                    </button>
                  </form>
                )}

              </div>

              {/* Right Column: List of items */}
              <div className="lg:col-span-2 bg-[#0e1726]/40 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-4">Listado de Datos</h3>

                {/* List: Tournaments */}
                {crudSubTab === 'tournaments' && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {tournaments.length === 0 ? <p className="text-sm text-gray-500">No hay torneos creados.</p> : tournaments.map(t => (
                      <div key={t.id} className="flex justify-between items-center p-4 bg-[#121b2d]/60 border border-gray-800 rounded-xl">
                        <span className="font-bold text-sm text-white">{t.name}</span>
                        <span className="text-xs text-gray-400">{t.id}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* List: Stadiums */}
                {crudSubTab === 'stadiums' && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {stadiums.length === 0 ? <p className="text-sm text-gray-500">No hay estadios registrados.</p> : stadiums.map(s => (
                      <div key={s.id} className="flex justify-between items-center p-4 bg-[#121b2d]/60 border border-gray-800 rounded-xl">
                        <span className="font-bold text-sm text-white">{s.name}</span>
                        <span className="text-xs text-gray-400">{s.id}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* List: Clubs */}
                {crudSubTab === 'clubs' && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {clubs.length === 0 ? <p className="text-sm text-gray-500">No hay clubes creados.</p> : clubs.map(c => (
                      <div key={c.id} className="p-4 bg-[#121b2d]/60 border border-gray-800 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-white">{c.name}</p>
                          <p className="text-xs text-gray-400 mt-1">Estadio: {c.stadium?.name || 'Sin Estadio'}</p>
                        </div>
                        <span className="text-xs bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-brand-400 font-semibold">{c.tacticalSystem || '4-3-3'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* List: Players */}
                {crudSubTab === 'players' && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {players.length === 0 ? <p className="text-sm text-gray-500">No hay jugadores enrolados.</p> : players.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-4 bg-[#121b2d]/60 border border-gray-800 rounded-xl">
                        <div>
                          <p className="font-bold text-sm text-white">{p.name}</p>
                          <p className="text-xs text-brand-400 mt-1">{p.currentClub?.name || 'Agente Libre'}</p>
                        </div>
                        <span className="text-xs text-gray-500">{p.id}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* List: Matches */}
                {crudSubTab === 'matches' && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {matches.length === 0 ? <p className="text-sm text-gray-500">No hay partidos.</p> : matches.map(m => (
                      <div key={m.id} className="p-4 bg-[#121b2d]/60 border border-gray-800 rounded-xl flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm text-white">{m.homeClub.name} vs {m.awayClub.name}</p>
                          <p className="text-xs text-gray-400 mt-1">Fecha: {new Date(m.date).toLocaleString()} | Estadio: {m.stadium.name}</p>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedMatchId(m.id);
                            setActiveTab('planilla');
                          }}
                          className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-xs font-bold text-white transition-colors">
                          Cargar Planilla
                        </button>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          </div>
        )}


        {/* ==================== TAB: PLANILLA DE PARTIDO ==================== */}
        {activeTab === 'planilla' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header selection card */}
            <div className="p-6 bg-[#0e1726]/40 border border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Planilla de Carga de Partido</h3>
                <p className="text-xs text-gray-400 mt-1">Selecciona un partido y el club del que registrarás su alineación y eventos.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <select 
                  value={selectedMatchId}
                  onChange={(e) => {
                    setSelectedMatchId(e.target.value);
                  }}
                  className="bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500">
                  <option value="">Selecciona Partido</option>
                  {matches.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.homeClub.name} vs {m.awayClub.name} (Jornada {m.matchday})
                    </option>
                  ))}
                </select>

                {selectedMatch && (
                  <select 
                    value={selectedClubId}
                    onChange={(e) => setSelectedClubId(e.target.value)}
                    className="bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500">
                    <option value={selectedMatch.homeClubId}>{selectedMatch.homeClub.name} (Local)</option>
                    <option value={selectedMatch.awayClubId}>{selectedMatch.awayClub.name} (Visitante)</option>
                  </select>
                )}
              </div>
            </div>

            {/* Main view panel */}
            {!selectedMatch ? (
              <div className="text-center py-20 bg-[#0e1726]/20 border border-gray-800 border-dashed rounded-2xl">
                <FileText className="h-16 w-16 mx-auto text-gray-600 mb-4" />
                <h4 className="text-lg font-bold text-gray-400">Ningún Partido Seleccionado</h4>
                <p className="text-sm text-gray-500 mt-1">Por favor selecciona un partido arriba para comenzar a cargar la planilla.</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Match Summary details */}
                <div className="p-6 bg-[#121b2d]/60 border border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <span className="text-xs bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2.5 py-1 rounded-lg font-bold">
                      Jornada {selectedMatch.matchday}
                    </span>
                    <h2 className="text-xl font-extrabold text-white mt-3">
                      {selectedMatch.homeClub.name} vs {selectedMatch.awayClub.name}
                    </h2>
                    <p className="text-xs text-gray-400">
                      Estadio: {selectedMatch.stadium.name} | Fecha: {new Date(selectedMatch.date).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <p className="text-xs font-semibold text-gray-400">Guardado en Base de Datos:</p>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${selectedMatch.lineups && selectedMatch.lineups.length > 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                      {selectedMatch.lineups && selectedMatch.lineups.length > 0 ? '✓ Con Planilla Registrada' : '⚠ Sin Planilla Inicial'}
                    </span>
                  </div>
                </div>

                {/* Lineup / Stats sheet loading */}
                <div className="bg-[#0e1726]/40 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-5 border-b border-gray-800 bg-[#0e1726]/80 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="h-4.5 w-4.5 text-brand-500" /> 
                      Planilla de Jugadores - {clubs.find(c => c.id === selectedClubId)?.name}
                    </h3>
                    <p className="text-xs text-gray-400">Valores por defecto aplicados a minutos y tarjetas.</p>
                  </div>

                  {Object.keys(lineupRows).length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <p className="text-sm font-semibold">No hay jugadores enrolados en este club.</p>
                      <p className="text-xs text-gray-600 mt-1">Por favor enrola jugadores para este club en la pestaña Enrolamiento (CRUD).</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-800/30 border-b border-gray-800 text-gray-400 font-bold uppercase tracking-wider">
                            <th className="p-4">Citado</th>
                            <th className="p-4">Jugador</th>
                            <th className="p-4">Alineación / Estado</th>
                            <th className="p-4">Sustituido (Sale)</th>
                            <th className="p-4">Reemplazado por</th>
                            <th className="p-4">Min. Cambio</th>
                            <th className="p-4 text-center">Goles</th>
                            <th className="p-4 text-center">Asist.</th>
                            <th className="p-4 text-center">Tarjetas Amarillas</th>
                            <th className="p-4 text-center">Rojas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/40">
                          {players
                            .filter(p => p.currentClubId === selectedClubId)
                            .map((player) => {
                              const row = lineupRows[player.id];
                              if (!row) return null;

                              // Filter available substitutes (other players from same club with status = 'suplente')
                              const availableSubs = players.filter(
                                p => p.currentClubId === selectedClubId && p.id !== player.id
                              );

                              return (
                                <tr key={player.id} className={`hover:bg-[#121b2d]/25 transition-colors ${!row.isCalledUp ? 'opacity-40' : ''}`}>
                                  
                                  {/* 1. isCalledUp Checkbox */}
                                  <td className="p-4 text-center">
                                    <input 
                                      type="checkbox"
                                      checked={row.isCalledUp}
                                      onChange={(e) => updateRow(player.id, 'isCalledUp', e.target.checked)}
                                      className="h-4 w-4 rounded border-gray-800 text-brand-500 bg-[#121b2d] focus:ring-brand-500"
                                    />
                                  </td>

                                  {/* 2. Player Name */}
                                  <td className="p-4 font-bold text-white text-sm">
                                    {player.name}
                                  </td>

                                  {/* 3. Status Dropdown */}
                                  <td className="p-4">
                                    <select
                                      disabled={!row.isCalledUp}
                                      value={row.status}
                                      onChange={(e) => updateRow(player.id, 'status', e.target.value)}
                                      className="bg-[#121b2d] border border-gray-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50">
                                      <option value="titular">Titular</option>
                                      <option value="suplente">Suplente</option>
                                      <option value="no_jugo">No jugó</option>
                                    </select>
                                  </td>

                                  {/* 4. isSubstituted Checkbox */}
                                  <td className="p-4 text-center">
                                    <input 
                                      type="checkbox"
                                      disabled={!row.isCalledUp || row.status === 'no_jugo'}
                                      checked={row.isSubstituted}
                                      onChange={(e) => updateRow(player.id, 'isSubstituted', e.target.checked)}
                                      className="h-4 w-4 rounded border-gray-800 text-brand-500 bg-[#121b2d] focus:ring-brand-500 disabled:opacity-50"
                                    />
                                  </td>

                                  {/* 5. SubstitutedById Dropdown */}
                                  <td className="p-4">
                                    <select
                                      disabled={!row.isCalledUp || !row.isSubstituted}
                                      value={row.substitutedById}
                                      onChange={(e) => updateRow(player.id, 'substitutedById', e.target.value)}
                                      className="bg-[#121b2d] border border-gray-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-40">
                                      <option value="">Selecciona Entra</option>
                                      {availableSubs.map(sub => (
                                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* 6. Substitution Minute Input */}
                                  <td className="p-4">
                                    <input 
                                      type="number"
                                      min={0}
                                      max={90}
                                      disabled={!row.isCalledUp || !row.isSubstituted}
                                      value={row.substitutionMinute}
                                      onChange={(e) => updateRow(player.id, 'substitutionMinute', Number(e.target.value))}
                                      className="w-16 bg-[#121b2d] border border-gray-800 rounded px-2 py-1 text-center text-white disabled:opacity-40"
                                    />
                                  </td>

                                  {/* 7. Goals Input */}
                                  <td className="p-4 text-center">
                                    <input 
                                      type="number"
                                      min={0}
                                      disabled={!row.isCalledUp || row.status === 'no_jugo'}
                                      value={row.goals}
                                      onChange={(e) => updateRow(player.id, 'goals', Number(e.target.value))}
                                      className="w-12 bg-[#121b2d] border border-gray-800 rounded px-1.5 py-1 text-center text-white disabled:opacity-50"
                                    />
                                  </td>

                                  {/* 8. Assists Input */}
                                  <td className="p-4 text-center">
                                    <input 
                                      type="number"
                                      min={0}
                                      disabled={!row.isCalledUp || row.status === 'no_jugo'}
                                      value={row.assists}
                                      onChange={(e) => updateRow(player.id, 'assists', Number(e.target.value))}
                                      className="w-12 bg-[#121b2d] border border-gray-800 rounded px-1.5 py-1 text-center text-white disabled:opacity-50"
                                    />
                                  </td>

                                  {/* 9. Yellow Cards Input */}
                                  <td className="p-4 text-center">
                                    <select
                                      disabled={!row.isCalledUp || row.status === 'no_jugo'}
                                      value={row.yellowCards}
                                      onChange={(e) => updateRow(player.id, 'yellowCards', Number(e.target.value))}
                                      className="bg-[#121b2d] border border-gray-800 rounded px-1.5 py-1 text-center text-white disabled:opacity-50">
                                      <option value={0}>0</option>
                                      <option value={1}>1</option>
                                      <option value={2}>2</option>
                                    </select>
                                  </td>

                                  {/* 10. Red Card Checkbox */}
                                  <td className="p-4 text-center">
                                    <input 
                                      type="checkbox"
                                      disabled={!row.isCalledUp || row.status === 'no_jugo' || row.yellowCards >= 2}
                                      checked={row.redCard}
                                      onChange={(e) => updateRow(player.id, 'redCard', e.target.checked)}
                                      className="h-4 w-4 rounded border-gray-800 text-brand-500 bg-[#121b2d] focus:ring-brand-500 disabled:opacity-50"
                                    />
                                  </td>

                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Actions footer */}
                  <div className="p-5 border-t border-gray-800 bg-[#0e1726]/60 flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      * Al guardar, los minutos de los jugadores entrantes y salientes se calculan automáticamente: <br/>
                      Min. Saliente = <code className="text-brand-400">minuto_cambio</code> | Min. Entrante = <code className="text-brand-400">90 - minuto_cambio</code>.
                    </p>
                    <button
                      onClick={handleRegisterPlanilla}
                      disabled={Object.keys(lineupRows).length === 0 || loading}
                      className="bg-brand-600 hover:bg-brand-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-brand-500/25 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5">
                      {loading ? 'Validando y Guardando...' : '✓ Guardar Planilla de Club'}
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}


        {/* ==================== TAB: REPORTES ==================== */}
        {activeTab === 'reportes' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header select filters */}
            <div className="p-6 bg-[#0e1726]/40 border border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Centro de Reportes Estadísticos</h3>
                <p className="text-xs text-gray-400 mt-1">Revisa el rendimiento acumulado de jugadores o las posiciones y esquemas tácticos de clubes.</p>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-gray-400 whitespace-nowrap">Filtrar por Torneo:</label>
                <select 
                  value={selectedTournamentId}
                  onChange={(e) => setSelectedTournamentId(e.target.value)}
                  className="bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500">
                  <option value="">Todos los Torneos</option>
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {/* Sub-navigation tabs */}
            <div className="flex border-b border-gray-800 gap-6">
              <button 
                onClick={() => setReportSubTab('players')} 
                className={`pb-3 font-bold text-sm border-b-2 transition-all duration-200 ${reportSubTab === 'players' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
                Estadísticas de Jugadores
              </button>
              <button 
                onClick={() => setReportSubTab('clubs')} 
                className={`pb-3 font-bold text-sm border-b-2 transition-all duration-200 ${reportSubTab === 'clubs' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
                Rendimiento de Clubes
              </button>
            </div>

            {/* 1. Sub-Tab Content: Players stats */}
            {reportSubTab === 'players' && (
              <div className="space-y-4">
                {/* Search player */}
                <div className="flex max-w-sm">
                  <input 
                    type="text" 
                    placeholder="Buscar jugador por nombre..."
                    value={filterPlayerName}
                    onChange={(e) => setFilterPlayerName(e.target.value)}
                    className="w-full bg-[#121b2d] border border-gray-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="bg-[#0e1726]/40 border border-gray-800 rounded-2xl overflow-hidden">
                  {loading ? (
                    <div className="p-12 text-center text-gray-400">Obteniendo datos...</div>
                  ) : playerReport.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No hay datos de rendimiento registrados para este torneo.</div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-800/30 border-b border-gray-800 text-gray-400 font-bold uppercase tracking-wider">
                          <th className="p-4">Jugador</th>
                          <th className="p-4">Club</th>
                          <th className="p-4 text-center">Minutos</th>
                          <th className="p-4 text-center">Goles</th>
                          <th className="p-4 text-center">Asistencias</th>
                          <th className="p-4 text-center">Tarjetas Amarillas</th>
                          <th className="p-4 text-center">Tarjetas Rojas</th>
                          <th className="p-4 text-center">Titularidad (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/40 text-sm text-gray-200">
                        {playerReport
                          .filter(row => row.name.toLowerCase().includes(filterPlayerName.toLowerCase()))
                          .map((row) => (
                            <tr key={row.id} className="hover:bg-[#121b2d]/25 transition-colors">
                              <td className="p-4 font-bold text-white">{row.name}</td>
                              <td className="p-4 text-xs font-semibold text-brand-400">{row.clubName}</td>
                              <td className="p-4 text-center">{row.totalMinutes}</td>
                              <td className="p-4 text-center font-bold text-emerald-400">{row.totalGoals}</td>
                              <td className="p-4 text-center text-indigo-400">{row.totalAssists}</td>
                              <td className="p-4 text-center text-amber-500 font-bold">{row.totalYellowCards}</td>
                              <td className="p-4 text-center text-rose-500 font-bold">{row.totalRedCards}</td>
                              <td className="p-4 text-center">
                                <span className="bg-gray-850 px-2.5 py-1 border border-gray-850 rounded text-xs text-white">
                                  {row.titularityPercentage}%
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* 2. Sub-Tab Content: Clubs Performance & Standing */}
            {reportSubTab === 'clubs' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Left Column: Standings Table */}
                <div className="lg:col-span-2 bg-[#0e1726]/40 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-gray-800 bg-[#0e1726]/80 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Award className="h-4.5 w-4.5 text-brand-500" /> Tabla de Posiciones / Rendimiento
                    </h3>
                  </div>

                  {loading ? (
                    <div className="p-12 text-center text-gray-400">Obteniendo datos...</div>
                  ) : clubReport.standings.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No hay partidos registrados en este torneo para calcular posiciones.</div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-800/30 border-b border-gray-800 text-gray-400 font-bold uppercase tracking-wider">
                          <th className="p-4">Club</th>
                          <th className="p-4 text-center">PJ</th>
                          <th className="p-4 text-center">PG</th>
                          <th className="p-4 text-center">PE</th>
                          <th className="p-4 text-center">PP</th>
                          <th className="p-4 text-center font-bold text-white">PTS</th>
                          <th className="p-4 text-center">GF</th>
                          <th className="p-4 text-center">GC</th>
                          <th className="p-4 text-center">DG</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/40 text-sm text-gray-200">
                        {clubReport.standings.map((club: any) => (
                          <tr key={club.id} className="hover:bg-[#121b2d]/25 transition-colors">
                            <td className="p-4 font-bold text-white">{club.name}</td>
                            <td className="p-4 text-center text-gray-400">{club.matchesPlayed}</td>
                            <td className="p-4 text-center text-emerald-400">{club.wins}</td>
                            <td className="p-4 text-center text-gray-400">{club.draws}</td>
                            <td className="p-4 text-center text-rose-500">{club.losses}</td>
                            <td className="p-4 text-center font-bold text-white bg-gray-800/20">{club.points}</td>
                            <td className="p-4 text-center text-emerald-300">{club.goalsFor}</td>
                            <td className="p-4 text-center text-rose-300">{club.goalsAgainst}</td>
                            <td className="p-4 text-center text-white">{club.goalsFor - club.goalsAgainst}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Right Column: Tactical distribution list */}
                <div className="bg-[#0e1726]/40 border border-gray-800 rounded-2xl p-6 space-y-6">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Shield className="h-4.5 w-4.5 text-brand-500" /> Esquemas Tácticos
                  </h3>
                  
                  {loading ? (
                    <div className="text-center text-gray-400">Cargando...</div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-gray-400">Distribución de los sistemas tácticos declarados en los clubes del torneo:</p>
                      
                      {Object.keys(clubReport.tacticalSystemsDistribution || {}).length === 0 ? (
                        <p className="text-xs text-gray-500 py-3 text-center">No hay clubes registrados.</p>
                      ) : (
                        Object.entries(clubReport.tacticalSystemsDistribution).map(([system, count]) => {
                          const percentage = Math.round((Number(count) / clubs.length) * 100);
                          return (
                            <div key={system} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-white">{system}</span>
                                <span className="text-brand-400">{count} {Number(count) === 1 ? 'Club' : 'Clubes'} ({percentage}%)</span>
                              </div>
                              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-brand-500 h-2 rounded-full transition-all duration-500" 
                                  style={{ width: `${percentage}%` }}>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* ==================== TAB: ADMIN ==================== */}
        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <AdminDashboard token={authToken} />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-900 bg-[#070b14] py-8 text-center text-xs text-gray-500 space-y-2">
        <p>⚽ Aplicación de Scouting y Gestión de Estadísticas de Fútbol.</p>
        <p>© 2026 Futbol Scouting Inc. Desarrollado con Node.js, Prisma ORM, React y Tailwind CSS.</p>
      </footer>

    </div>
  );
}
