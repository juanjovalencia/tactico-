import React, { useEffect, useState } from 'react';
import {
  Users, Activity, Clock, TrendingUp, FileText,
  Wifi, WifiOff, RefreshCw, Shield
} from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : 'https://tactico-backend-jj.loca.lt/api';

interface UserStat {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    role: string;
  };
  totalUploads: number;
  lastUpload: string | null;
  lastSeen: string | null;
  isOnline: boolean;
  recentActivity: ActivityEntry[];
}

interface ActivityEntry {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  action: string;
  detail: string;
  matchId?: string;
  timestamp: string;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days}d`;
}

export default function AdminDashboard({ token }: { token: string }) {
  const [stats, setStats] = useState<UserStat[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [resStats, resActivity] = await Promise.all([
        fetch(`${API_BASE}/activity/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/activity?limit=20`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
      ]);
      const statsData = await resStats.json();
      const activityData = await resActivity.json();
      setStats(Array.isArray(statsData) ? statsData : []);
      setActivity(Array.isArray(activityData) ? activityData : []);
      setLastRefresh(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalUploads = stats.reduce((s, u) => s + u.totalUploads, 0);
  const onlineUsers = stats.filter(u => u.isOnline && u.user.username !== 'tactico');

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Admin Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Panel de Administración</h2>
            <p className="text-xs text-gray-400">Actividad del equipo en tiempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Actualizado: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-2 rounded-xl border border-gray-800 bg-[#121b2d] hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0e1726]/60 border border-gray-800 p-5 rounded-2xl">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Usuarios</p>
          <p className="text-3xl font-extrabold mt-1 text-white">{stats.length}</p>
          <p className="text-xs text-gray-500 mt-1">en el sistema</p>
        </div>
        <div className="bg-[#0e1726]/60 border border-gray-800 p-5 rounded-2xl">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">En Línea</p>
          <p className="text-3xl font-extrabold mt-1 text-emerald-400">{onlineUsers.length}</p>
          <p className="text-xs text-gray-500 mt-1">activos ahora</p>
        </div>
        <div className="bg-[#0e1726]/60 border border-gray-800 p-5 rounded-2xl">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Planillas</p>
          <p className="text-3xl font-extrabold mt-1 text-brand-400">{totalUploads}</p>
          <p className="text-xs text-gray-500 mt-1">total subidas</p>
        </div>
        <div className="bg-[#0e1726]/60 border border-gray-800 p-5 rounded-2xl">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Actividades</p>
          <p className="text-3xl font-extrabold mt-1 text-purple-400">{activity.length}</p>
          <p className="text-xs text-gray-500 mt-1">registros recientes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Stats Table */}
        <div className="lg:col-span-2 bg-[#0e1726]/40 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
            <Users className="h-5 w-5 text-brand-500" /> Analistas del Equipo
          </h3>
          <div className="space-y-3">
            {stats
              .filter(s => s.user.username !== 'tactico')
              .sort((a, b) => b.totalUploads - a.totalUploads)
              .map((stat, idx) => (
                <div
                  key={stat.user.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-[#121b2d]/60 border border-gray-800 hover:border-gray-700 transition-all"
                >
                  {/* Rank */}
                  <span className={`text-sm font-black w-6 text-center ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-600' : 'text-gray-600'}`}>
                    #{idx + 1}
                  </span>
                  {/* Avatar */}
                  <div className="relative">
                    <div className="h-10 w-10 rounded-xl bg-[#1e2a3d] border border-gray-700 flex items-center justify-center text-xl">
                      {stat.user.avatar}
                    </div>
                    {/* Online indicator */}
                    <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0e1726] ${stat.isOnline ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{stat.user.displayName}</p>
                    <p className="text-xs text-gray-500">@{stat.user.username} · {stat.isOnline ? (
                      <span className="text-emerald-400 font-semibold">En línea</span>
                    ) : (
                      <span>{timeAgo(stat.lastSeen)}</span>
                    )}</p>
                  </div>
                  {/* Stats */}
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-brand-400">{stat.totalUploads}</p>
                    <p className="text-xs text-gray-500">planillas</p>
                  </div>
                  {/* Last upload */}
                  <div className="text-right hidden md:block">
                    <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />
                      {timeAgo(stat.lastUpload)}
                    </p>
                    <p className="text-xs text-gray-600">última subida</p>
                  </div>
                  {/* Online badge */}
                  <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${stat.isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                    {stat.isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {stat.isOnline ? 'Online' : 'Offline'}
                  </div>
                </div>
              ))}
            {stats.filter(s => s.user.username !== 'tactico').length === 0 && (
              <p className="text-center text-sm text-gray-600 py-8">Ningún analista ha iniciado sesión aún</p>
            )}
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="bg-[#0e1726]/40 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
            <Activity className="h-5 w-5 text-emerald-500 animate-pulse" />
            Actividad en Vivo
          </h3>
          {activity.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-600">Sin actividad registrada</p>
              <p className="text-xs text-gray-700 mt-1">Las planillas subidas aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {activity.map(entry => (
                <div key={entry.id} className="flex gap-3 p-3 rounded-xl bg-[#121b2d]/40 border border-gray-800">
                  <div className="h-8 w-8 rounded-lg bg-[#1e2a3d] flex items-center justify-center shrink-0 text-sm">
                    {entry.action === 'upload_planilla' ? '📋' : '👤'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{entry.displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{entry.detail}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{timeAgo(entry.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Auto-refresh indicator */}
          <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-2 text-xs text-gray-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            Actualización automática cada 5s
          </div>
        </div>
      </div>

      {/* Work analytics bar chart */}
      {stats.filter(s => s.user.username !== 'tactico' && s.totalUploads > 0).length > 0 && (
        <div className="bg-[#0e1726]/40 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
            <TrendingUp className="h-5 w-5 text-purple-400" /> Planillas Subidas por Usuario
          </h3>
          <div className="space-y-3">
            {stats
              .filter(s => s.user.username !== 'tactico')
              .sort((a, b) => b.totalUploads - a.totalUploads)
              .map(stat => {
                const maxUploads = Math.max(...stats.map(s => s.totalUploads), 1);
                const pct = (stat.totalUploads / maxUploads) * 100;
                return (
                  <div key={stat.user.id} className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-gray-300 w-32 shrink-0 truncate">
                      {stat.user.displayName}
                    </span>
                    <div className="flex-1 h-6 bg-[#121b2d] rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-600 to-emerald-500 rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      >
                        {stat.totalUploads > 0 && (
                          <span className="text-xs font-bold text-white">{stat.totalUploads}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
