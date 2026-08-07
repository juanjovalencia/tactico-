import React, { useState } from 'react';
import { Trophy, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : 'https://tactico-backend-jj.loca.lt/api';

interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'analyst';
  avatar: string;
}

interface LoginPageProps {
  onLogin: (user: AppUser, token: string) => void;
}

const QUICK_USERS = [
  { username: 'tactico', displayName: 'Táctico Admin', avatar: '🎯', role: 'Admin' },
  { username: 'scouter1', displayName: 'Carlos Mendoza', avatar: '📊', role: 'Analista' },
  { username: 'scouter2', displayName: 'Diego Fuentes', avatar: '⚽', role: 'Analista' },
  { username: 'scouter3', displayName: 'Andrés Silva', avatar: '📋', role: 'Analista' },
  { username: 'scouter4', displayName: 'Felipe Torres', avatar: '🔍', role: 'Analista' },
];

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (u?: string, p?: string) => {
    const usr = u ?? username;
    const pwd = p ?? password;
    if (!usr || !pwd) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usr, password: pwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión');
      } else {
        localStorage.setItem('tactico_token', data.token);
        localStorage.setItem('tactico_user', JSON.stringify(data.user));
        onLogin(data.user, data.token);
      }
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (usr: string) => {
    setUsername(usr);
    setPassword('123');
    handleLogin(usr, '123');
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-4 relative z-10">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-2xl shadow-brand-500/30 animate-pulse">
          <Trophy className="h-10 w-10 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-100 to-brand-400">
            TÁCTICO
          </h1>
          <p className="text-sm text-gray-400 font-medium tracking-widest uppercase mt-1">
            Analytics &amp; Management
          </p>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-[#0c1220]/90 border border-gray-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-xl font-bold text-white mb-1">Iniciar Sesión</h2>
          <p className="text-sm text-gray-400 mb-6">Ingresa tus credenciales para acceder a la plataforma</p>

          {error && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Usuario
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="ej: tactico"
                className="w-full bg-[#121b2d] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••"
                  className="w-full bg-[#121b2d] border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              onClick={() => handleLogin()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-brand-600/30 mt-2"
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600 font-medium">ACCESO RÁPIDO</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Quick user buttons */}
          <div className="grid grid-cols-1 gap-2">
            {QUICK_USERS.map(u => (
              <button
                key={u.username}
                onClick={() => handleQuickLogin(u.username)}
                disabled={loading}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-800 bg-[#121b2d]/60 hover:border-brand-500/40 hover:bg-brand-500/5 transition-all duration-200 group disabled:opacity-50"
              >
                <span className="text-xl">{u.avatar}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-white group-hover:text-brand-400 transition-colors">
                    {u.displayName}
                  </p>
                  <p className="text-xs text-gray-500">@{u.username}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.role === 'Admin' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'}`}>
                  {u.role}
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          Todos los usuarios · Contraseña: <span className="text-gray-500 font-mono">123</span>
        </p>
      </div>
    </div>
  );
}
