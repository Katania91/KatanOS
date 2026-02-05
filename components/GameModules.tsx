import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Play, RefreshCw, Grid3X3, Grid2X2, Rocket, Shield, Crosshair, Brain, Cpu, MousePointer2, Zap, Trophy, TrendingUp, TrendingDown, Terminal } from 'lucide-react';
import { db } from '../services/db';
import { useTranslation } from '../services/useTranslation';

const COPYRIGHT_TEXT = `© ${new Date().getFullYear()} Katania`;

const getCurrentUserId = () => {
  try {
    return db.auth.getCurrentUser()?.id || 'guest';
  } catch (e) {
    return 'guest';
  }
};

const getGameStorageKey = (gameId: string, suffix: string, userId?: string) => {
  return `katanos_game_${gameId}_${suffix}_${userId || getCurrentUserId()}`;
};

const readStoredNumber = (key: string, fallback = 0) => {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
};

const writeStoredNumber = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {
    // ignore storage errors
  }
};

const readStoredJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch (e) {
    return fallback;
  }
};

const writeStoredJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // ignore storage errors
  }
};

// --- Helpers ---
const StartOverlay = ({ onStart, title = "READY?", subtitle = "Press Start" }: any) => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-[60] animate-fade-in">
    <h2 className="text-4xl font-display font-bold text-white mb-2">{title}</h2>
    <p className="text-slate-300 mb-6 text-sm">{subtitle}</p>
    <button onClick={onStart} className="px-8 py-3 bg-white text-black rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2">
      <Play size={18} fill="black" /> PLAY
    </button>
  </div>
);

const GameOverOverlay = ({ score, bestScore, onRetry }: any) => {
  const showBest = typeof bestScore === 'number';
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center animate-fade-in backdrop-blur-md">
      <h2 className="text-4xl font-display font-bold text-red-500 mb-2">GAME OVER</h2>
      <p className={`text-white ${showBest ? 'mb-2' : 'mb-6'}`}>Final Score: {score}</p>
      {showBest && <p className="text-slate-300 mb-6 text-sm">Best: {bestScore}</p>}
      <button onClick={onRetry} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
        <RefreshCw size={18} /> Retry
      </button>
    </div>
  );
};

// 1. SNAKE
export const SnakeGame = ({ onExit }: { onExit: () => void }) => {
  const [snake, setSnake] = useState([[10, 10]]);
  const [food, setFood] = useState([15, 15]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const bestScoreKeyRef = useRef(getGameStorageKey('snake', 'best'));
  const [bestScore, setBestScore] = useState(() => readStoredNumber(bestScoreKeyRef.current));
  const directionRef = useRef([0, 1]);
  const inputQueueRef = useRef<number[][]>([]);
  const speedRef = useRef(150);
  const boardSize = 20;

  useEffect(() => { inputQueueRef.current = []; directionRef.current = [0, 1]; }, []);

  const resetGame = () => {
    setSnake([[10, 10]]); setFood([5, 5]); setScore(0); setGameOver(false);
    speedRef.current = 150; directionRef.current = [0, 1]; inputQueueRef.current = [];
  };

  const moveSnake = useCallback(() => {
    if (gameOver) return;
    if (inputQueueRef.current.length > 0) {
      const nextDir = inputQueueRef.current.shift();
      if (nextDir) {
        const isOpposite = (nextDir[0] === -directionRef.current[0] && nextDir[1] === -directionRef.current[1]);
        if (!isOpposite) directionRef.current = nextDir;
      }
    }
    const curDir = directionRef.current;
    const newSnake = [...snake];
    const head = newSnake[newSnake.length - 1];
    const newHead = [head[0] + curDir[0], head[1] + curDir[1]];

    if (newHead[0] < 0 || newHead[0] >= boardSize || newHead[1] < 0 || newHead[1] >= boardSize) { setGameOver(true); return; }
    for (let i = 0; i < newSnake.length - 1; i++) { if (newSnake[i][0] === newHead[0] && newSnake[i][1] === newHead[1]) { setGameOver(true); return; } }

    newSnake.push(newHead);
    if (newHead[0] === food[0] && newHead[1] === food[1]) {
      setScore(s => s + 10); speedRef.current = Math.max(50, speedRef.current * 0.98);
      let newFood; let isOnSnake = true;
      while (isOnSnake) {
        newFood = [Math.floor(Math.random() * boardSize), Math.floor(Math.random() * boardSize)];
        isOnSnake = newSnake.some(s => s[0] === newFood![0] && s[1] === newFood![1]);
        if (!isOnSnake) setFood(newFood);
      }
    } else { newSnake.shift(); }
    setSnake(newSnake);
  }, [snake, food, gameOver]);

  useEffect(() => { const interval = setInterval(moveSnake, speedRef.current); return () => clearInterval(interval); }, [moveSnake]);

  useEffect(() => {
    if (!gameOver) return;
    setBestScore(prev => {
      if (score > prev) {
        writeStoredNumber(bestScoreKeyRef.current, score);
        return score;
      }
      return prev;
    });
  }, [gameOver, score]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      let nextDir: number[] | null = null;
      switch (e.key) { case 'ArrowUp': nextDir = [-1, 0]; break; case 'ArrowDown': nextDir = [1, 0]; break; case 'ArrowLeft': nextDir = [0, -1]; break; case 'ArrowRight': nextDir = [0, 1]; break; }
      if (nextDir && inputQueueRef.current.length < 2) inputQueueRef.current.push(nextDir);
    };
    window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full glass-panel relative rounded-2xl overflow-hidden border border-indigo-500/20 shadow-2xl">
      <div className="absolute top-4 left-6 text-white font-mono z-10">
        SCORE: <span className="text-emerald-400 font-bold">{score}</span> | BEST: <span className="text-slate-300 font-bold">{bestScore}</span>
      </div>
      <button onClick={onExit} className="absolute top-4 right-6 text-slate-300 hover:text-white z-20"><X /></button>
      {gameOver && <GameOverOverlay score={score} bestScore={bestScore} onRetry={resetGame} />}
      <div className="grid bg-black/40 border border-white/10 shadow-2xl" style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)`, width: 'min(500px, 90vw)', height: 'min(500px, 90vw)' }}>
        {Array.from({ length: boardSize * boardSize }).map((_, i) => {
          const y = Math.floor(i / boardSize); const x = i % boardSize;
          const isSnake = snake.some(s => s[0] === y && s[1] === x); const isFood = food[0] === y && food[1] === x;
          return <div key={i} className={`${isSnake ? 'bg-indigo-500 rounded-sm' : isFood ? 'bg-emerald-400 rounded-full scale-75 animate-pulse' : ''} border border-white/[0.02]`}></div>;
        })}
      </div>
      <div className="absolute bottom-4 text-[10px] text-slate-600 font-mono tracking-widest">{COPYRIGHT_TEXT}</div>
    </div>
  );
};

// 2. SHOOTER
export const ShooterGame = ({ onExit }: { onExit: () => void }) => {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'over'>('start');
  const [score, setScore] = useState(0);
  const bestScoreKeyRef = useRef(getGameStorageKey('shooter', 'best'));
  const [bestScore, setBestScore] = useState(() => readStoredNumber(bestScoreKeyRef.current));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef(0);
  const state = useRef({ playerX: 200, bullets: [] as any[], enemies: [] as any[], lastShot: 0, spawnTimer: 0, width: 400, height: 600 });

  const loop = () => {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext('2d'); if (!ctx) return;
    const s = state.current;
    s.playerX = Math.max(20, Math.min(s.width - 20, s.playerX));
    s.spawnTimer++;
    if (s.spawnTimer > 60) { s.enemies.push({ x: Math.random() * (s.width - 40) + 20, y: -20, hp: 1 }); s.spawnTimer = 0; }
    for (let i = s.bullets.length - 1; i >= 0; i--) { s.bullets[i].y -= 10; if (s.bullets[i].y < 0) s.bullets.splice(i, 1); }
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      s.enemies[i].y += 2;
      if (s.enemies[i].y > s.height - 50 && Math.abs(s.enemies[i].x - s.playerX) < 25) setGameState('over');
      for (let j = s.bullets.length - 1; j >= 0; j--) {
        const b = s.bullets[j]; const e = s.enemies[i];
        if (e && Math.abs(b.x - e.x) < 20 && Math.abs(b.y - e.y) < 20) { s.bullets.splice(j, 1); s.enemies.splice(i, 1); setScore(sc => sc + 10); break; }
      }
      if (s.enemies[i] && s.enemies[i].y > s.height) setGameState('over');
    }
    ctx.clearRect(0, 0, s.width, s.height);
    ctx.fillStyle = 'white'; if (Math.random() > 0.8) ctx.fillRect(Math.random() * s.width, Math.random() * s.height, 2, 2);
    ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.moveTo(s.playerX, s.height - 40); ctx.lineTo(s.playerX - 15, s.height - 10); ctx.lineTo(s.playerX + 15, s.height - 10); ctx.fill();
    ctx.fillStyle = '#ef4444'; s.bullets.forEach(b => ctx.fillRect(b.x - 2, b.y, 4, 10));
    ctx.fillStyle = '#a855f7'; s.enemies.forEach(e => { ctx.beginPath(); ctx.arc(e.x, e.y, 15, 0, Math.PI * 2); ctx.fill(); });
    if (gameState === 'playing') reqRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => { if (gameState === 'playing') { state.current = { ...state.current, bullets: [], enemies: [] }; setScore(0); reqRef.current = requestAnimationFrame(loop); } else cancelAnimationFrame(reqRef.current); return () => cancelAnimationFrame(reqRef.current); }, [gameState]);

  useEffect(() => {
    if (gameState !== 'over') return;
    setBestScore(prev => {
      if (score > prev) {
        writeStoredNumber(bestScoreKeyRef.current, score);
        return score;
      }
      return prev;
    });
  }, [gameState, score]);
  const handleMouseMove = (e: React.MouseEvent) => { if (!canvasRef.current || gameState !== 'playing') return; const rect = canvasRef.current.getBoundingClientRect(); const scaleX = canvasRef.current.width / rect.width; state.current.playerX = (e.clientX - rect.left) * scaleX; };
  const handleMouseDown = () => { if (gameState !== 'playing') return; state.current.bullets.push({ x: state.current.playerX, y: state.current.height - 40 }); };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full glass-panel rounded-2xl border border-indigo-500/20 shadow-2xl relative overflow-hidden">
      <button onClick={onExit} className="absolute top-4 right-6 text-slate-300 hover:text-white z-20"><X /></button>
      <div className="absolute top-4 left-6 text-white font-mono z-20">SCORE: {score} | BEST: {bestScore}</div>
      {gameState === 'start' && <StartOverlay onStart={() => setGameState('playing')} title="SPACE DEFENDER" subtitle="Mouse to Move & Click to Shoot" />}
      {gameState === 'over' && <GameOverOverlay score={score} bestScore={bestScore} onRetry={() => setGameState('playing')} />}
      <canvas ref={canvasRef} width={400} height={600} onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} className="bg-black/20 border border-white/10 rounded-xl h-[80vh] w-auto cursor-crosshair touch-none" />
      <div className="absolute bottom-4 text-[10px] text-slate-600 font-mono tracking-widest">{COPYRIGHT_TEXT}</div>
    </div>
  )
};

// 3. BREAKER
export const BreakerGame = ({ onExit }: { onExit: () => void }) => {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'over' | 'win'>('start');
  const [score, setScore] = useState(0);
  const bestScoreKeyRef = useRef(getGameStorageKey('breaker', 'best'));
  const [bestScore, setBestScore] = useState(() => readStoredNumber(bestScoreKeyRef.current));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef(0);
  const state = useRef({ padX: 250, ball: { x: 300, y: 320, dx: 3.2, dy: -3.2 }, bricks: [] as any[], width: 600, height: 480 });

  const initBricks = () => { const bricks = []; for (let r = 0; r < 5; r++) { for (let c = 0; c < 8; c++) { if (Math.random() > 0.1) bricks.push({ x: c * 70 + 25, y: r * 25 + 40, status: 1 }); } } state.current.bricks = bricks; };
  const loop = () => {
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    const s = state.current;
    const b = s.ball;
    const radius = 8;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.dx), Math.abs(b.dy)) / 2));

    for (let i = 0; i < steps; i++) {
      b.x += b.dx / steps;
      b.y += b.dy / steps;

      if (b.x - radius <= 0 || b.x + radius >= s.width) {
        b.dx *= -1;
        b.x = Math.min(s.width - radius, Math.max(radius, b.x));
      }
      if (b.y - radius <= 0) {
        b.dy *= -1;
        b.y = radius;
      }
      if (b.y - radius > s.height) {
        setGameState('over');
        break;
      }

      const paddleTop = s.height - 20;
      const paddleBottom = paddleTop + 10;
      if (
        b.dy > 0 &&
        b.y + radius >= paddleTop &&
        b.y - radius <= paddleBottom &&
        b.x >= s.padX &&
        b.x <= s.padX + 100
      ) {
        b.dy = -Math.abs(b.dy);
        b.dx = (b.x - (s.padX + 50)) * 0.12;
        b.y = paddleTop - radius;
      }

      let hitIndex = -1;
      for (let idx = 0; idx < s.bricks.length; idx++) {
        const brick = s.bricks[idx];
        if (brick.status !== 1) continue;
        if (
          b.x + radius > brick.x &&
          b.x - radius < brick.x + 60 &&
          b.y + radius > brick.y &&
          b.y - radius < brick.y + 20
        ) {
          hitIndex = idx;
          break;
        }
      }

      if (hitIndex !== -1) {
        const brick = s.bricks[hitIndex];
        brick.status = 0;
        setScore(sc => sc + 10);

        const overlapLeft = b.x + radius - brick.x;
        const overlapRight = brick.x + 60 - (b.x - radius);
        const overlapTop = b.y + radius - brick.y;
        const overlapBottom = brick.y + 20 - (b.y - radius);
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapLeft || minOverlap === overlapRight) {
          b.dx *= -1;
        } else {
          b.dy *= -1;
        }
      }
    }

    if (s.bricks.every(br => br.status === 0)) setGameState('win');
    ctx.clearRect(0, 0, s.width, s.height);
    ctx.fillStyle = '#6366f1'; ctx.fillRect(s.padX, s.height - 20, 100, 10);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, radius, 0, Math.PI * 2); ctx.fill();
    s.bricks.forEach(brick => { if (brick.status === 1) { ctx.fillStyle = `hsl(${brick.y * 2}, 70%, 50%)`; ctx.fillRect(brick.x, brick.y, 60, 20); } });
    if (gameState === 'playing') reqRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => { if (gameState === 'playing') { state.current.ball = { x: 300, y: 320, dx: 3.2, dy: -3.2 }; initBricks(); setScore(0); reqRef.current = requestAnimationFrame(loop); } else cancelAnimationFrame(reqRef.current); return () => cancelAnimationFrame(reqRef.current); }, [gameState]);

  useEffect(() => {
    if (gameState !== 'over' && gameState !== 'win') return;
    setBestScore(prev => {
      if (score > prev) {
        writeStoredNumber(bestScoreKeyRef.current, score);
        return score;
      }
      return prev;
    });
  }, [gameState, score]);
  const handleMove = (e: React.MouseEvent) => { const rect = canvasRef.current?.getBoundingClientRect(); if (rect) state.current.padX = Math.min(500, Math.max(0, e.clientX - rect.left - 50)); };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full glass-panel rounded-2xl border border-indigo-500/20 shadow-2xl relative overflow-hidden">
      <button onClick={onExit} className="absolute top-4 right-6 text-slate-300 hover:text-white z-20"><X /></button>
      <div className="absolute top-4 left-6 text-white font-mono z-20">SCORE: {score} | BEST: {bestScore}</div>
      {(gameState === 'start' || gameState === 'win') && <StartOverlay onStart={() => setGameState('playing')} title={gameState === 'win' ? "CLEARED!" : "CYBER BREAKER"} subtitle="Mouse to move" />}
      {gameState === 'over' && <GameOverOverlay score={score} bestScore={bestScore} onRetry={() => setGameState('playing')} />}
      <canvas ref={canvasRef} width={600} height={480} onMouseMove={handleMove} className="bg-black/20 border border-white/10 rounded-xl cursor-none shadow-2xl max-w-full" />
      <div className="absolute bottom-4 text-[10px] text-slate-600 font-mono tracking-widest">{COPYRIGHT_TEXT}</div>
    </div>
  );
};

// 4. TICTACTOE
export const TicTacToe = ({ onExit }: { onExit: () => void }) => {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);

  const checkWin = (squares: any[]) => {
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    for (let i = 0; i < lines.length; i++) { const [a, b, c] = lines[i]; if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a]; }
    return null;
  };
  const minimax = (squares: any[], depth: number, isMax: boolean): number => {
    const w = checkWin(squares);
    if (w === 'O') return 10 - depth; if (w === 'X') return depth - 10; if (!squares.includes(null)) return 0;
    if (isMax) { let best = -Infinity; for (let i = 0; i < 9; i++) { if (!squares[i]) { squares[i] = 'O'; best = Math.max(best, minimax(squares, depth + 1, false)); squares[i] = null; } } return best; }
    else { let best = Infinity; for (let i = 0; i < 9; i++) { if (!squares[i]) { squares[i] = 'X'; best = Math.min(best, minimax(squares, depth + 1, true)); squares[i] = null; } } return best; }
  };
  useEffect(() => {
    if (!isPlayerTurn && !winner) {
      const timer = setTimeout(() => {
        let bestVal = -Infinity; let bestMove = -1; const newBoard = [...board];
        if (board.every(c => c === null)) bestMove = 4;
        else { for (let i = 0; i < 9; i++) { if (!newBoard[i]) { newBoard[i] = 'O'; const moveVal = minimax(newBoard, 0, false); newBoard[i] = null; if (moveVal > bestVal) { bestMove = i; bestVal = moveVal; } } } }
        if (bestMove !== -1) handleClick(bestMove, 'O');
      }, 500); return () => clearTimeout(timer);
    }
  }, [isPlayerTurn, winner, board]);
  const handleClick = (i: number, player: string) => { if (board[i] || winner) return; const newBoard = [...board]; newBoard[i] = player; setBoard(newBoard); const w = checkWin(newBoard); if (w) setWinner(w); else if (!newBoard.includes(null)) setWinner('draw'); else setIsPlayerTurn(player === 'O'); };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full glass-panel rounded-2xl relative">
      <button onClick={onExit} className="absolute top-4 right-6 text-slate-300 hover:text-white"><X /></button>
      <h2 className="text-3xl font-bold text-white mb-8">NEON TACTICS</h2>
      <div className="grid grid-cols-3 gap-3 bg-slate-800 p-4 rounded-xl shadow-2xl">
        {board.map((cell, i) => (<button key={i} onClick={() => isPlayerTurn && handleClick(i, 'X')} className={`w-20 h-20 bg-slate-900 rounded-lg text-4xl font-bold flex items-center justify-center transition-all ${!cell && !winner && isPlayerTurn ? 'hover:bg-slate-700' : ''}`}><span className={cell === 'X' ? 'text-cyan-400' : 'text-pink-500'}>{cell}</span></button>))}
      </div>
      {winner && (<div className="mt-8 text-xl font-bold text-white animate-bounce">{winner === 'draw' ? 'DRAW!' : winner === 'X' ? 'YOU WIN!' : 'AI WINS!'}</div>)}
      {winner && (<button onClick={() => { setBoard(Array(9).fill(null)); setWinner(null); setIsPlayerTurn(true); }} className="mt-4 px-6 py-2 bg-indigo-600 rounded-lg text-white">RETRY</button>)}
      <div className="absolute bottom-4 text-[10px] text-slate-600 font-mono tracking-widest">{COPYRIGHT_TEXT}</div>
    </div>
  )
};

// 5. REFLEX
export const ReflexGame = ({ onExit }: { onExit: () => void }) => {
  const [target, setTarget] = useState({ x: 50, y: 50 });
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<'classic' | 'speedrun'>('classic');
  const targetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameActiveRef = useRef(false);
  const scoreRef = useRef(0);
  const bestScoreKeyRef = useRef(getGameStorageKey('reflex', 'best'));
  const [bestScore, setBestScore] = useState(() => readStoredNumber(bestScoreKeyRef.current));

  useEffect(() => {
    if (active && timeLeft > 0) {
      const t = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(t);
    } else if (timeLeft === 0) {
      setActive(false);
      gameActiveRef.current = false;
      if (targetTimerRef.current) clearTimeout(targetTimerRef.current);
    }
  }, [active, timeLeft]);

  useEffect(() => {
    if (timeLeft !== 0) return;
    setBestScore(prev => {
      if (score > prev) {
        writeStoredNumber(bestScoreKeyRef.current, score);
        return score;
      }
      return prev;
    });
  }, [timeLeft, score]);

  const handleMiss = () => {
    if (!gameActiveRef.current) return;
    setTarget({ x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 });
    const delay = Math.max(600, 2000 - (scoreRef.current * 50));
    targetTimerRef.current = setTimeout(() => handleMiss(), delay);
  };

  const hit = () => {
    if (!active) return;
    if (targetTimerRef.current) clearTimeout(targetTimerRef.current);

    const newScore = score + 1;
    setScore(newScore);
    scoreRef.current = newScore;

    setTarget({ x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 });

    if (mode === 'speedrun') {
      const delay = Math.max(600, 2000 - (newScore * 50));
      targetTimerRef.current = setTimeout(() => handleMiss(), delay);
    }
  };

  const startGame = (selectedMode: 'classic' | 'speedrun') => {
    setMode(selectedMode);
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(30);
    setActive(true);
    gameActiveRef.current = true;
    setTarget({ x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 });

    if (selectedMode === 'speedrun') {
      if (targetTimerRef.current) clearTimeout(targetTimerRef.current);
      targetTimerRef.current = setTimeout(() => handleMiss(), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full glass-panel rounded-2xl relative overflow-hidden">
      <button onClick={onExit} className="absolute top-4 right-6 text-slate-300 hover:text-white z-20"><X /></button>
      {!active && timeLeft === 30 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-30 animate-fade-in">
          <h2 className="text-4xl font-display font-bold text-white mb-2">REFLEX GRID</h2>
          <p className="text-slate-300 mb-6 text-sm">Select Mode</p>
          <div className="flex gap-4">
            <button onClick={() => startGame('classic')} className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2">
              CLASSIC
            </button>
            <button onClick={() => startGame('speedrun')} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2">
              <Zap size={18} fill="currentColor" /> SPEED RUN
            </button>
          </div>
        </div>
      )}
      {!active && timeLeft === 0 && <GameOverOverlay score={score} bestScore={bestScore} onRetry={() => { setTimeLeft(30); }} />}
      <div className="absolute top-4 left-6 text-white font-mono text-xl z-10">SCORE: {score} | BEST: {bestScore} | TIME: {timeLeft}</div>
      <div className="w-full h-full relative cursor-crosshair">
        {active && (<button onMouseDown={hit} style={{ left: `${target.x}%`, top: `${target.y}%` }} className="absolute w-12 h-12 -ml-6 -mt-6 bg-red-500 rounded-full border-4 border-white shadow-[0_0_20px_rgba(239,68,68,0.8)] active:scale-90 transition-transform"><div className="absolute inset-0 m-auto w-2 h-2 bg-white rounded-full"></div></button>)}
      </div>
      <div className="absolute bottom-4 text-[10px] text-slate-600 font-mono tracking-widest">{COPYRIGHT_TEXT}</div>
    </div>
  )
};

// 6. MEMORY
export const MemoryGame = ({ onExit }: { onExit: () => void }) => {
  const ICONS_POOL = ['🚀', '💎', '⚡', '🧬', '🔮', '🪐', '🎮', '🤖', '👾', '🔥', '💀', '👽'];
  const COLORS_POOL = ['text-red-400', 'text-blue-400', 'text-yellow-400', 'text-green-400', 'text-purple-400', 'text-orange-400'];
  const [cards, setCards] = useState<any[]>([]);
  const [turns, setTurns] = useState(0);
  const [choiceOne, setChoiceOne] = useState<any>(null);
  const [choiceTwo, setChoiceTwo] = useState<any>(null);
  const [disabled, setDisabled] = useState(false);
  const [difficulty, setDifficulty] = useState<'normal' | 'medium' | 'hard'>('normal');
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'won'>('menu');

  const setupGame = (diff: 'normal' | 'medium' | 'hard') => {
    setDifficulty(diff);
    let pairCount = 6;
    if (diff === 'medium') pairCount = 10;
    if (diff === 'hard') pairCount = 12;

    const deck = ICONS_POOL.slice(0, pairCount).map((icon, index) => ({ id: index, icon: icon, color: COLORS_POOL[index % COLORS_POOL.length] }));
    const shuffledCards = [...deck, ...deck].sort(() => Math.random() - 0.5).map((card) => ({ ...card, uid: Math.random(), matched: false }));
    setCards(shuffledCards); setTurns(0); setChoiceOne(null); setChoiceTwo(null); setDisabled(false); setGameState('playing');
  };

  useEffect(() => {
    if (choiceOne && choiceTwo) {
      setDisabled(true);
      if (choiceOne.id === choiceTwo.id) { setCards(prev => prev.map(c => c.id === choiceOne.id ? { ...c, matched: true } : c)); resetTurn(); }
      else setTimeout(() => resetTurn(), 1000);
    }
  }, [choiceOne, choiceTwo]);

  useEffect(() => { if (cards.length > 0 && cards.every(c => c.matched)) setTimeout(() => setGameState('won'), 500); }, [cards]);
  const resetTurn = () => { setChoiceOne(null); setChoiceTwo(null); setTurns(prev => prev + 1); setDisabled(false); };
  const handleChoice = (card: any) => { if (choiceOne && choiceOne.uid === card.uid) return; choiceOne ? setChoiceTwo(card) : setChoiceOne(card); };

  if (gameState === 'menu') return (
    <div className="flex flex-col items-center justify-center h-full w-full glass-panel rounded-2xl border border-indigo-500/20 relative">
      <button onClick={onExit} className="absolute top-4 right-6 text-slate-300 hover:text-white"><X /></button>
      <h2 className="text-4xl font-display font-bold text-white mb-8">CYBER MATCH</h2>
      <div className="flex gap-6">
        <button onClick={() => setupGame('normal')} className="flex flex-col items-center gap-2 p-6 bg-slate-800 hover:bg-indigo-600 rounded-2xl transition-all border border-white/5 hover:scale-105 group"><Grid2X2 size={40} className="text-indigo-400 group-hover:text-white" /><span className="font-bold text-white">NORMAL</span></button>
        <button onClick={() => setupGame('medium')} className="flex flex-col items-center gap-2 p-6 bg-slate-800 hover:bg-cyan-600 rounded-2xl transition-all border border-white/5 hover:scale-105 group"><Grid3X3 size={40} className="text-cyan-400 group-hover:text-white" /><span className="font-bold text-white">MEDIUM</span></button>
        <button onClick={() => setupGame('hard')} className="flex flex-col items-center gap-2 p-6 bg-slate-800 hover:bg-purple-600 rounded-2xl transition-all border border-white/5 hover:scale-105 group"><Brain size={40} className="text-purple-400 group-hover:text-white" /><span className="font-bold text-white">HARD</span></button>
      </div>
      <div className="absolute bottom-4 text-[10px] text-slate-600 font-mono tracking-widest">{COPYRIGHT_TEXT}</div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center h-full w-full glass-panel relative rounded-2xl border border-indigo-500/20 shadow-2xl p-4 overflow-hidden">
      <button onClick={onExit} className="absolute top-4 right-6 text-slate-300 hover:text-white z-20"><X /></button>
      <div className="absolute top-4 left-6 text-white font-mono z-10 flex gap-4 items-center"><div>TURNS: <span className="text-indigo-400 font-bold">{turns}</span></div><button onClick={() => setGameState('menu')} className="text-xs text-slate-500 hover:text-white bg-white/5 px-2 py-1 rounded">MENU</button></div>
      {gameState === 'won' && <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center animate-fade-in backdrop-blur-md"><Trophy className="text-yellow-400 mb-4 animate-bounce" size={64} /><h2 className="text-3xl font-bold text-white mb-2">MEMORY RESTORED!</h2><div className="flex gap-4"><button onClick={() => setGameState('menu')} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold">Menu</button><button onClick={() => setupGame(difficulty)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold">Play Again</button></div></div>}
      <div className={`grid gap-3 w-full max-w-2xl mx-auto h-full max-h-[80vh] items-center justify-center content-center ${difficulty === 'hard' ? 'grid-cols-6' : difficulty === 'medium' ? 'grid-cols-5' : 'grid-cols-4'}`}>
        {cards.map(card => {
          const flipped = card === choiceOne || card === choiceTwo || card.matched;
          return <div key={card.uid} onClick={() => !disabled && !flipped && handleChoice(card)} className={`relative aspect-square cursor-pointer rounded-xl transition-all duration-500 transform ${difficulty === 'hard' ? 'w-14 md:w-16' : 'w-20 md:w-24'} ${flipped ? 'rotate-y-180' : ''}`} style={{ perspective: '1000px' }}><div className={`absolute inset-0 bg-indigo-900/40 border-2 border-indigo-500/30 rounded-xl flex items-center justify-center backface-hidden transition-all duration-300 ${flipped ? 'opacity-0 rotate-y-180' : 'opacity-100 hover:border-indigo-400'}`}><Brain size={difficulty === 'hard' ? 16 : 24} className="text-indigo-500/50" /></div><div className={`absolute inset-0 bg-slate-800 border-2 border-white/10 rounded-xl flex items-center justify-center shadow-xl transition-all duration-300 ${flipped ? 'opacity-100 rotate-y-0' : 'opacity-0 -rotate-y-180'} ${card.matched ? 'border-emerald-500/50 bg-emerald-500/10' : ''}`}><span className={`${card.color} ${difficulty === 'hard' ? 'text-xl' : 'text-3xl'}`}>{card.icon}</span></div></div>;
        })}
      </div>
      <div className="absolute bottom-4 text-[10px] text-slate-600 font-mono tracking-widest">{COPYRIGHT_TEXT}</div>
    </div>
  );
};

export const MinerGame = ({ onExit }: { onExit: () => void }) => {
  const { t } = useTranslation();
  const [bits, setBits] = useState(0);
  const [cpuCount, setCpuCount] = useState(0);
  const [gpuCount, setGpuCount] = useState(0);
  const [asicCount, setAsicCount] = useState(0);
  const [serverCount, setServerCount] = useState(0);
  const [quantumCount, setQuantumCount] = useState(0);
  const [aiCount, setAiCount] = useState(0);

  // New Mechanics
  const [marketTrend, setMarketTrend] = useState(1.0); // Multiplier 0.5x to 2.0x
  const [floatingTexts, setFloatingTexts] = useState<{ id: number, x: number, y: number, text: string, color: string }[]>([]);
  const [newsKey, setNewsKey] = useState<string>("miner_market_stable");

  const [bonusActive, setBonusActive] = useState(false);
  const [bonusOffer, setBonusOffer] = useState<{ cost: number, duration: number } | null>(null);
  const [bonusEndTime, setBonusEndTime] = useState<number | null>(null);
  const bitsRef = useRef(bits);
  const bonusActiveRef = useRef(bonusActive);
  const bonusOfferRef = useRef(bonusOffer);
  const bonusTimeoutRef = useRef<number | null>(null);

  const saveKeyRef = useRef(getGameStorageKey('miner', 'state'));
  const costGrowth = 1.5;

  const getCost = (base: number, count: number) => Math.floor(base * Math.pow(costGrowth, count));

  // Calculate Rates
  const baseClickPower = 1 + cpuCount + quantumCount * 5;
  const clickPower = Math.floor(baseClickPower * marketTrend);

  const baseAutoRate = gpuCount + asicCount * 5 + serverCount * 10 + aiCount * 25;
  const boostedAutoRate = bonusActive ? baseAutoRate * 2 : baseAutoRate;
  const currentAutoRate = Math.floor(boostedAutoRate * marketTrend);

  const gpuCost = getCost(50, gpuCount);
  const cpuCost = getCost(100, cpuCount);
  const asicCost = getCost(250, asicCount);
  const serverCost = getCost(500, serverCount);
  const quantumCost = getCost(800, quantumCount);
  const aiCost = getCost(2500, aiCount);

  useEffect(() => {
    bitsRef.current = bits;
  }, [bits]);

  useEffect(() => {
    bonusActiveRef.current = bonusActive;
  }, [bonusActive]);

  useEffect(() => {
    bonusOfferRef.current = bonusOffer;
  }, [bonusOffer]);

  useEffect(() => {
    const saved = readStoredJson<any>(saveKeyRef.current, null);
    if (!saved) return;
    setBits(Number(saved.bits) || 0);
    setCpuCount(Number(saved.cpuCount) || 0);
    setGpuCount(Number(saved.gpuCount) || 0);
    setAsicCount(Number(saved.asicCount) || 0);
    setServerCount(Number(saved.serverCount) || 0);
    setQuantumCount(Number(saved.quantumCount) || 0);
    setAiCount(Number(saved.aiCount) || 0);
    if (saved.marketTrend) setMarketTrend(Number(saved.marketTrend));
    if (saved.newsKey) setNewsKey(String(saved.newsKey));
  }, []);

  useEffect(() => {
    writeStoredJson(saveKeyRef.current, {
      bits,
      cpuCount,
      gpuCount,
      asicCount,
      serverCount,
      quantumCount,
      aiCount,
      marketTrend,
      newsKey
    });
  }, [bits, cpuCount, gpuCount, asicCount, serverCount, quantumCount, aiCount, marketTrend, newsKey]);

  // Market Trend Logic
  useEffect(() => {
    const interval = setInterval(() => {
      const change = Math.random();
      let newTrend = marketTrend;
      let newNewsKey = "miner_market_stable";

      if (change > 0.95) {
        newTrend = 2.0;
        newNewsKey = "miner_market_boom";
      } else if (change < 0.05) {
        newTrend = 0.5;
        newNewsKey = "miner_market_crash";
      } else {
        // Drift
        const drift = (Math.random() - 0.5) * 0.2;
        newTrend = Math.max(0.5, Math.min(2.0, marketTrend + drift));
        newNewsKey = newTrend > 1 ? "miner_market_bullish" : "miner_market_bearish";
      }
      setMarketTrend(Number(newTrend.toFixed(2)));
      setNewsKey(newNewsKey);
    }, 5000);
    return () => clearInterval(interval);
  }, [marketTrend]);

  useEffect(() => {
    if (!bonusEndTime) return;
    const interval = setInterval(() => {
      if (Date.now() > bonusEndTime) {
        setBonusActive(false);
        setBonusEndTime(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [bonusEndTime]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!bonusActiveRef.current && !bonusOfferRef.current && Math.random() > 0.9 && bitsRef.current > 100) {
        const cost = Math.max(50, Math.floor(bitsRef.current * 0.3));
        setBonusOffer({ cost, duration: 30 });
        if (bonusTimeoutRef.current !== null) {
          window.clearTimeout(bonusTimeoutRef.current);
        }
        bonusTimeoutRef.current = window.setTimeout(() => setBonusOffer(null), 10000);
      }
    }, 3000);
    return () => {
      window.clearInterval(interval);
      if (bonusTimeoutRef.current !== null) {
        window.clearTimeout(bonusTimeoutRef.current);
        bonusTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (currentAutoRate <= 0) return;
    const intervalMs = 1000;
    const interval = setInterval(() => {
      setBits(b => b + currentAutoRate);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [currentAutoRate]);

  const handleMainClick = (e: React.MouseEvent) => {
    const isCrit = Math.random() > 0.9;
    const amount = isCrit ? clickPower * 5 : clickPower;
    setBits(b => b + amount);

    // Floating Text
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const id = Date.now();
    setFloatingTexts(prev => [...prev, {
      id,
      x,
      y,
      text: `+${amount}${isCrit ? t('miner_crit') : ''}`,
      color: isCrit ? 'text-yellow-400' : 'text-white'
    }]);

    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== id));
    }, 1000);
  };

  const buyGpu = () => { if (bits >= gpuCost) { setBits(b => b - gpuCost); setGpuCount(c => c + 1); } };
  const buyCpu = () => { if (bits >= cpuCost) { setBits(b => b - cpuCost); setCpuCount(c => c + 1); } };
  const buyAsic = () => { if (bits >= asicCost) { setBits(b => b - asicCost); setAsicCount(c => c + 1); } };
  const buyServer = () => { if (bits >= serverCost) { setBits(b => b - serverCost); setServerCount(c => c + 1); } };
  const buyQuantum = () => { if (bits >= quantumCost) { setBits(b => b - quantumCost); setQuantumCount(c => c + 1); } };
  const buyAi = () => { if (bits >= aiCost) { setBits(b => b - aiCost); setAiCount(c => c + 1); } };

  const buyBonus = () => {
    if (!bonusOffer) return;
    if (bits >= bonusOffer.cost) {
      setBits(b => b - bonusOffer.cost);
      setBonusActive(true);
      setBonusEndTime(Date.now() + bonusOffer.duration * 1000);
      setBonusOffer(null);
      if (bonusTimeoutRef.current !== null) {
        window.clearTimeout(bonusTimeoutRef.current);
        bonusTimeoutRef.current = null;
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full glass-panel rounded-2xl border border-indigo-500/20 shadow-2xl overflow-hidden relative">
      <div className="bg-slate-900/90 p-4 border-b border-white/10 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center"><Cpu className="text-white" /></div>
          <div>
            <h3 className="font-bold text-white leading-none">{t('game_miner_title')}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span>{currentAutoRate}/s</span>
              <span className="text-slate-500">|</span>
              <span>{clickPower}/click</span>
              <span className="text-slate-500">|</span>
              <span className={`${marketTrend > 1 ? 'text-green-400' : marketTrend < 1 ? 'text-red-400' : 'text-slate-300'} flex items-center gap-1`}>
                {marketTrend > 1 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {t('miner_market_label')}: {Math.round(marketTrend * 100)}%
              </span>
            </div>
          </div>
        </div>
        <button onClick={onExit} className="text-slate-300 hover:text-white"><X /></button>
      </div>

      {/* News Ticker - Terminal Style */}
      <div className="bg-[#0c0c0c] border-b border-slate-700/50 p-2 shadow-xl font-mono text-xs relative overflow-hidden flex flex-col z-20">
        {/* Terminal Header */}
        <div className="flex items-center justify-between mb-1 border-b border-white/10 pb-1">
          <div className="flex items-center gap-2 text-slate-300">
            <Terminal size={12} />
            <span className="font-bold text-[10px] uppercase tracking-wider">KatanOS News</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500/20"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/20"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/20"></div>
          </div>
        </div>

        {/* Terminal Content */}
        <div className="text-green-500 leading-relaxed overflow-hidden whitespace-nowrap">
          <span className="mr-2 text-green-700">$</span>
          {t(newsKey)}
          <span className="inline-block w-1.5 h-3 bg-green-500 ml-1 align-middle animate-pulse"></span>
        </div>

        {/* Scan Line Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent pointer-events-none bg-[length:100%_4px] animate-scanline"></div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 p-8 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-900 to-slate-900 relative overflow-hidden">
          {bonusActive && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 px-4 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2 z-20">
              <Zap size={12} fill="currentColor" /> {t('miner_2x_speed')}
            </div>
          )}
          {bonusOffer && !bonusActive && (
            <button onClick={buyBonus} className="absolute top-20 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-2 rounded-full font-bold shadow-lg animate-bounce flex items-center gap-2 hover:bg-emerald-400 transition-colors z-20">
              <Zap size={16} fill="currentColor" /> {t('miner_buy_boost').replace('{cost}', bonusOffer.cost.toString())}
            </button>
          )}

          <div className="text-center mb-10 relative z-10">
            <span className="text-slate-300 text-sm font-bold uppercase tracking-widest">{t('miner_balance')}</span>
            <h1 className="text-5xl md:text-6xl font-mono font-bold text-white mt-2 drop-shadow-lg">{bits.toLocaleString()} <span className="text-indigo-500 text-2xl">{t('miner_bits')}</span></h1>
          </div>

          <div className="relative">
            <button
              onClick={handleMainClick}
              className="w-48 h-48 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-700 shadow-[0_0_50px_rgba(79,70,229,0.3)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all group border-4 border-indigo-400/30 relative z-10"
            >
              <MousePointer2 size={64} className="text-white drop-shadow-lg group-hover:text-indigo-100" />
            </button>

            {/* Floating Text Container */}
            {floatingTexts.map(ft => (
              <div
                key={ft.id}
                className={`absolute pointer-events-none font-bold text-xl animate-float-up ${ft.color} drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] z-50`}
                style={{ left: ft.x, top: ft.y }}
              >
                {ft.text}
              </div>
            ))}
          </div>

          <p className="mt-8 text-slate-500 text-xs animate-pulse">{t('miner_click_to_mine')}</p>
        </div>
        <div className="w-full md:w-80 bg-slate-900/95 border-l border-white/10 p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar z-20">
          <h4 className="text-white font-bold uppercase tracking-wider text-sm mb-2">{t('miner_hardware_store')}</h4>

          <button onClick={buyGpu} disabled={bits < gpuCost} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-white/5 hover:bg-slate-700/50 disabled:opacity-50 transition-all group">
            <div className="flex items-center gap-3">
              <Cpu size={20} className="text-cyan-400" />
              <div className="text-left">
                <div className="text-white font-bold text-sm group-hover:text-indigo-300 transition-colors">{t('miner_gpu')}</div>
                <div className="text-xs text-slate-300">{t('miner_gpu_desc').replace('{count}', gpuCount.toString())}</div>
              </div>
            </div>
            <div className={`font-mono font-bold ${bits >= gpuCost ? 'text-green-400' : 'text-red-400'}`}>{gpuCost.toLocaleString()}</div>
          </button>

          <button onClick={buyCpu} disabled={bits < cpuCost} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-white/5 hover:bg-slate-700/50 disabled:opacity-50 transition-all group">
            <div className="flex items-center gap-3">
              <Zap size={20} className="text-yellow-400" />
              <div className="text-left">
                <div className="text-white font-bold text-sm group-hover:text-indigo-300 transition-colors">{t('miner_cpu')}</div>
                <div className="text-xs text-slate-300">{t('miner_cpu_desc').replace('{count}', cpuCount.toString())}</div>
              </div>
            </div>
            <div className={`font-mono font-bold ${bits >= cpuCost ? 'text-green-400' : 'text-red-400'}`}>{cpuCost.toLocaleString()}</div>
          </button>

          <button onClick={buyAsic} disabled={bits < asicCost} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-white/5 hover:bg-slate-700/50 disabled:opacity-50 transition-all group">
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-emerald-400" />
              <div className="text-left">
                <div className="text-white font-bold text-sm group-hover:text-indigo-300 transition-colors">{t('miner_asic')}</div>
                <div className="text-xs text-slate-300">{t('miner_asic_desc').replace('{count}', asicCount.toString())}</div>
              </div>
            </div>
            <div className={`font-mono font-bold ${bits >= asicCost ? 'text-green-400' : 'text-red-400'}`}>{asicCost.toLocaleString()}</div>
          </button>

          <button onClick={buyServer} disabled={bits < serverCost} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-white/5 hover:bg-slate-700/50 disabled:opacity-50 transition-all group">
            <div className="flex items-center gap-3">
              <RefreshCw size={20} className="text-purple-400" />
              <div className="text-left">
                <div className="text-white font-bold text-sm group-hover:text-indigo-300 transition-colors">{t('miner_server')}</div>
                <div className="text-xs text-slate-300">{t('miner_server_desc').replace('{count}', serverCount.toString())}</div>
              </div>
            </div>
            <div className={`font-mono font-bold ${bits >= serverCost ? 'text-green-400' : 'text-red-400'}`}>{serverCost.toLocaleString()}</div>
          </button>

          <button onClick={buyQuantum} disabled={bits < quantumCost} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-white/5 hover:bg-slate-700/50 disabled:opacity-50 transition-all group">
            <div className="flex items-center gap-3">
              <Rocket size={20} className="text-indigo-300" />
              <div className="text-left">
                <div className="text-white font-bold text-sm group-hover:text-indigo-300 transition-colors">{t('miner_quantum')}</div>
                <div className="text-xs text-slate-300">{t('miner_quantum_desc').replace('{count}', quantumCount.toString())}</div>
              </div>
            </div>
            <div className={`font-mono font-bold ${bits >= quantumCost ? 'text-green-400' : 'text-red-400'}`}>{quantumCost.toLocaleString()}</div>
          </button>

          <button onClick={buyAi} disabled={bits < aiCost} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-white/5 hover:bg-slate-700/50 disabled:opacity-50 transition-all group">
            <div className="flex items-center gap-3">
              <Brain size={20} className="text-pink-300" />
              <div className="text-left">
                <div className="text-white font-bold text-sm group-hover:text-indigo-300 transition-colors">{t('miner_ai')}</div>
                <div className="text-xs text-slate-300">{t('miner_ai_desc').replace('{count}', aiCount.toString())}</div>
              </div>
            </div>
            <div className={`font-mono font-bold ${bits >= aiCost ? 'text-green-400' : 'text-red-400'}`}>{aiCost.toLocaleString()}</div>
          </button>
        </div>
      </div>
      <div className="absolute bottom-4 left-6 text-[10px] text-slate-600 font-mono tracking-widest">{COPYRIGHT_TEXT}</div>
      <style>{`
        @keyframes float-up {
            0% { transform: translateY(0) scale(1); opacity: 1; }
            100% { transform: translateY(-50px) scale(1.5); opacity: 0; }
        }
        .animate-float-up {
            animation: float-up 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
