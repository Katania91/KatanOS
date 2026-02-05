import React from 'react';
import appLogo from '../assets/icon.webp';

interface SplashScreenProps {
    isVisible: boolean;
    progress?: number; // 0-100
}

const SplashScreen: React.FC<SplashScreenProps> = ({ isVisible, progress = 0 }) => {
    if (!isVisible) return null;

    // Generate floating particles
    const particles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        size: Math.random() * 4 + 2,
        left: Math.random() * 100,
        delay: Math.random() * 5,
        duration: Math.random() * 10 + 10,
    }));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

            {/* Moving gradient orbs */}
            <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/20 rounded-full blur-[100px] animate-float-slow" />
            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary/15 rounded-full blur-[120px] animate-float-slow-reverse" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[150px] animate-pulse-slow" />

            {/* Floating particles */}
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute rounded-full bg-white/20 animate-float-particle"
                    style={{
                        width: p.size,
                        height: p.size,
                        left: `${p.left}%`,
                        bottom: '-10px',
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                    }}
                />
            ))}

            {/* Grid pattern overlay */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
                    backgroundSize: '50px 50px',
                }}
            />

            {/* Scanline effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 animate-scanline opacity-[0.03]"
                    style={{ background: 'linear-gradient(transparent 50%, rgba(255,255,255,0.1) 50%)', backgroundSize: '100% 4px' }}
                />
            </div>

            {/* Main content */}
            <div className="relative z-10 flex flex-col items-center">
                {/* Logo with glow ring */}
                <div className="relative mb-8 animate-splash-logo">
                    {/* Rotating ring */}
                    <div className="absolute -inset-4 rounded-full border border-primary/30 animate-spin-slow" />
                    <div className="absolute -inset-6 rounded-full border border-secondary/20 animate-spin-slower" style={{ animationDirection: 'reverse' }} />

                    {/* Glow */}
                    <div className="absolute inset-0 bg-primary/40 rounded-2xl blur-2xl animate-pulse" />

                    {/* Logo */}
                    <div className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-2xl shadow-primary/40 border border-white/20 bg-slate-900">
                        <img
                            src={appLogo}
                            alt="KatanOS"
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>

                {/* App name with gradient */}
                <h1 className="font-display font-bold text-5xl text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-400 to-secondary mb-3 animate-splash-text tracking-tight">
                    KatanOS
                </h1>

                {/* Tagline */}
                <p className="text-slate-400 text-sm tracking-[0.3em] uppercase mb-12 animate-splash-text" style={{ animationDelay: '0.2s' }}>
                    Your life, your system, your rules.
                </p>

                {/* Progress bar with glow */}
                <div className="relative w-56">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-md" />
                    <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                        <div
                            className="h-full bg-gradient-to-r from-primary via-indigo-400 to-secondary rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                        />
                    </div>
                </div>

                {/* Loading text */}
                <p className="text-slate-500 text-xs mt-4 tracking-wider">
                    {progress < 100 ? 'Initializing...' : 'Ready'}
                </p>
            </div>

            {/* Version and copyright */}
            <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1">
                <p className="text-slate-600 text-xs font-mono tracking-widest">v1.0.9</p>
                <p className="text-slate-700 text-[10px]">© 2026 Katania</p>
            </div>
        </div>
    );
};

export default SplashScreen;
