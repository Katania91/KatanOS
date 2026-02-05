
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { useTranslation } from '../services/useTranslation';
import { Gamepad2, Rocket, Shield, Crosshair, Grid3X3, Brain, Cpu, Play } from 'lucide-react';
import { SnakeGame, ShooterGame, BreakerGame, ReflexGame, TicTacToe, MemoryGame, MinerGame } from '../components/GameModules';

interface GamesProps {
  user: User;
}

// --- MAIN COMPONENT ---
const Games: React.FC<GamesProps> = ({ user }) => {
  const { t } = useTranslation();
  const lang = user.language || 'it';
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (event: Event) => {
      if (!activeGameId) return;
      setActiveGameId(null);
      const custom = event as CustomEvent<{ handled?: boolean }>;
      if (custom.detail) {
        custom.detail.handled = true;
      }
    };
    window.addEventListener('katanos:escape', handleEscape);
    return () => window.removeEventListener('katanos:escape', handleEscape);
  }, [activeGameId]);

  const NATIVE_GAMES = [
    { id: 'snake', title: t('game_snake_title', lang), desc: t('game_snake_desc', lang), icon: Gamepad2, color: 'bg-emerald-500' },
    { id: 'shooter', title: t('game_shooter_title', lang), desc: t('game_shooter_desc', lang), icon: Rocket, color: 'bg-blue-500' },
    { id: 'breaker', title: t('game_breaker_title', lang), desc: t('game_breaker_desc', lang), icon: Shield, color: 'bg-indigo-500' },
    { id: 'reflex', title: t('game_reflex_title', lang), desc: t('game_reflex_desc', lang), icon: Crosshair, color: 'bg-red-500' },
    { id: 'tictactoe', title: t('game_tictactoe_title', lang), desc: t('game_tictactoe_desc', lang), icon: Grid3X3, color: 'bg-cyan-500' },
    { id: 'memory', title: t('game_memory_title', lang), desc: t('game_memory_desc', lang), icon: Brain, color: 'bg-purple-500' },
    { id: 'miner', title: t('game_miner_title', lang), desc: t('game_miner_desc', lang), icon: Cpu, color: 'bg-slate-500' },
  ];

  if (activeGameId === 'snake') return <div className="h-full p-2 animate-scale-in"><SnakeGame onExit={() => setActiveGameId(null)} /></div>;
  if (activeGameId === 'memory') return <div className="h-full p-2 animate-scale-in"><MemoryGame onExit={() => setActiveGameId(null)} /></div>;
  if (activeGameId === 'miner') return <div className="h-full p-2 animate-scale-in"><MinerGame onExit={() => setActiveGameId(null)} /></div>;
  if (activeGameId === 'shooter') return <div className="h-full p-2 animate-scale-in"><ShooterGame onExit={() => setActiveGameId(null)} /></div>;
  if (activeGameId === 'breaker') return <div className="h-full p-2 animate-scale-in"><BreakerGame onExit={() => setActiveGameId(null)} /></div>;
  if (activeGameId === 'tictactoe') return <div className="h-full p-2 animate-scale-in"><TicTacToe onExit={() => setActiveGameId(null)} /></div>;
  if (activeGameId === 'reflex') return <div className="h-full p-2 animate-scale-in"><ReflexGame onExit={() => setActiveGameId(null)} /></div>;

  return (
    <div className="h-full flex flex-col space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col">
        <h2 className="text-3xl font-display font-bold text-white flex items-center gap-3">
          {t('games', lang)} <Gamepad2 className="text-indigo-400" size={28} />
        </h2>
        <p className="text-slate-300 text-sm mt-1">{t('gamesSubtitle', lang)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {NATIVE_GAMES.map(game => {
          const Icon = game.icon;
          return (
            <div key={game.id} onClick={() => setActiveGameId(game.id)} className="group relative glass-panel p-8 rounded-3xl cursor-pointer hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col items-center text-center overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1 ${game.color}`}></div>
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className={`w-20 h-20 ${game.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg rotate-3 group-hover:rotate-6 transition-transform`}><Icon size={40} className="text-white" /></div>
              <h3 className="text-2xl font-bold text-white mb-2">{game.title}</h3>
              <p className="text-slate-300 text-sm mb-6">{game.desc}</p>
              <button className="px-6 py-2 rounded-full bg-white/10 group-hover:bg-indigo-500 group-hover:text-white transition-colors text-sm font-bold flex items-center gap-2"><Play size={14} fill="currentColor" /> {t('playNow', lang)}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Games;
