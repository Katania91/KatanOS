import React, { useEffect, useState, memo } from 'react';
import { useTranslation } from '../services/useTranslation';

// --- CSS STYLES FOR ANIMATION ---
const styles = `
  .flip-clock-container {
    perspective: 400px;
  }
  
  .flip-card {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
  }

  .flip-leaf {
    position: absolute;
    left: 0;
    width: 100%;
    height: 50%;
    overflow: hidden;
    backface-visibility: hidden;
    background-color: #1e1e1e;
    color: #e0e0e0;
  }

  /* TOP HALF */
  .flip-leaf-top {
    top: 0;
    border-radius: 0.5rem 0.5rem 0 0;
    transform-origin: bottom;
    border-top: 1px solid #333;
    border-left: 1px solid #333;
    border-right: 1px solid #333;
    border-bottom: 1px solid rgba(0,0,0,0.5); 
  }

  /* BOTTOM HALF */
  .flip-leaf-bottom {
    bottom: 0;
    border-radius: 0 0 0.5rem 0.5rem;
    transform-origin: top;
    border-bottom: 1px solid #333;
    border-left: 1px solid #333;
    border-right: 1px solid #333;
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  /* TEXT CONTAINER & ALIGNMENT */
  .flip-text {
    position: absolute;
    left: 0;
    width: 100%;
    height: 200%; /* Double height of leaf = Full height of clock */
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -2px;
  }

  /* Top leaf shows the top half of the text (0 to 50%) */
  .flip-leaf-top .flip-text {
    top: 0;
  }

  /* Bottom leaf shows the bottom half of the text (50% to 100%) */
  /* We shift the text UP by 100% of the leaf height (which is 50% of total) */
  .flip-leaf-bottom .flip-text {
    top: -100%; 
  }

  /* ANIMATIONS */
  .animate-flip-down {
    animation: flipDown 0.4s cubic-bezier(0.455, 0.030, 0.515, 0.955) forwards;
  }

  .animate-flip-up {
    animation: flipUp 0.4s cubic-bezier(0.455, 0.030, 0.515, 0.955) forwards;
  }

  @keyframes flipDown {
    0% { transform: rotateX(0deg); }
    100% { transform: rotateX(-180deg); }
  }

  @keyframes flipUp {
    0% { transform: rotateX(180deg); }
    100% { transform: rotateX(0deg); }
  }
`;

// Memoized styles to prevent re-injection on every tick
const FlipStyles = memo(() => <style>{styles}</style>);

interface FlipUnitProps {
  digit: string | number;
  label?: string;
}

const FlipUnit: React.FC<FlipUnitProps> = ({ digit, label }) => {
  // Current visible digit (static)
  const [currentDigit, setCurrentDigit] = useState(digit);
  // Previous digit (used for the animation flip)
  const [prevDigit, setPrevDigit] = useState(digit);
  // Animation state
  const [isFlipping, setIsFlipping] = useState(false);

  const format = (val: string | number) => String(val).padStart(2, '0');

  useEffect(() => {
    // If the prop digit is different from what we are showing
    if (digit !== currentDigit) {
      setPrevDigit(currentDigit); // The old number becomes 'prev'
      setCurrentDigit(digit);     // The new number becomes 'current'
      setIsFlipping(true);        // Trigger animation

      const timer = setTimeout(() => {
        setIsFlipping(false);
        setPrevDigit(digit); // Sync prev to current after animation ends
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [digit, currentDigit]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flip-clock-container relative w-[clamp(58px,8.2vmin,170px)] h-[clamp(72px,9.4vmin,190px)] bg-[#121212] rounded-xl shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
        
        {/* Hinge Details - Visual Only */}
        <div className="absolute top-1/2 -left-[2px] w-1 h-3 bg-[#0a0a0a] -translate-y-1/2 rounded-r border border-[#222] z-50"></div>
        <div className="absolute top-1/2 -right-[2px] w-1 h-3 bg-[#0a0a0a] -translate-y-1/2 rounded-l border border-[#222] z-50"></div>

        {/* --- STATIC LAYERS --- */}
        
        {/* Top Half (New Digit) - Background (Underneath) */}
        <div className="flip-leaf flip-leaf-top z-0">
          <div className="flip-text text-[clamp(2.1rem,5.1vmin,5.2rem)]">{format(currentDigit)}</div>
        </div>
        
        {/* Bottom Half (Old/Current Digit) - Background (Underneath) */}
        <div className="flip-leaf flip-leaf-bottom z-0">
           <div className="flip-text text-[clamp(2.1rem,5.1vmin,5.2rem)]">{format(isFlipping ? prevDigit : currentDigit)}</div>
        </div>

        {/* --- ANIMATING LAYERS --- */}
        {isFlipping && (
          <>
            {/* Old Top Leaf flipping down */}
            {/* Uses a key to force remount if rapid changes occur, ensuring animation plays */}
            <div key={`top-${prevDigit}`} className="flip-leaf flip-leaf-top animate-flip-down z-20" style={{ backfaceVisibility: 'hidden' }}>
              <div className="flip-text text-[clamp(2.1rem,5.1vmin,5.2rem)]">{format(prevDigit)}</div>
            </div>

            {/* New Bottom Leaf flipping up */}
            <div key={`bottom-${currentDigit}`} className="flip-leaf flip-leaf-bottom animate-flip-up z-20" style={{ backfaceVisibility: 'hidden' }}>
              <div className="flip-text text-[clamp(2.1rem,5.1vmin,5.2rem)]">{format(currentDigit)}</div>
            </div>
          </>
        )}
        
        {/* Subtle inner shadow for depth */}
        <div className="absolute inset-0 z-40 rounded-xl pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"></div>

      </div>
      {label && <span className="text-[clamp(9px,1.2vmin,14px)] font-bold text-slate-300 uppercase tracking-[0.2em]">{label}</span>}
    </div>
  );
};

interface FlipClockProps {
  time: Date;
  lang?: string;
  use12Hour?: boolean;
}

const FlipClock: React.FC<FlipClockProps> = ({ time, lang = 'it', use12Hour = false }) => {
  const { t } = useTranslation();
  const hours24 = time.getHours();
  const hours = use12Hour ? ((hours24 + 11) % 12) + 1 : hours24;
  const meridiem = hours24 >= 12 ? t('clock_pm', lang) : t('clock_am', lang);

  return (
    <>
      <FlipStyles />
      <div className="flex items-center gap-[clamp(6px,1.4vmin,14px)] select-none origin-left">
        <FlipUnit key="hours" digit={hours} label={t('clock_hours', lang)} />
        
        {/* Separator */}
        <div className="flex flex-col gap-[clamp(8px,1.4vmin,14px)] h-[clamp(48px,8vmin,80px)] justify-center px-[clamp(4px,0.9vmin,10px)]">
             <div className="w-[clamp(4px,0.8vmin,8px)] h-[clamp(4px,0.8vmin,8px)] rounded-full bg-slate-300 shadow-inner"></div>
             <div className="w-[clamp(4px,0.8vmin,8px)] h-[clamp(4px,0.8vmin,8px)] rounded-full bg-slate-300 shadow-inner"></div>
        </div>

        <FlipUnit key="minutes" digit={time.getMinutes()} label={t('clock_minutes', lang)} />
        
        {/* Separator */}
        <div className="flex flex-col gap-[clamp(8px,1.4vmin,14px)] h-[clamp(48px,8vmin,80px)] justify-center px-[clamp(4px,0.9vmin,10px)]">
             <div className="w-[clamp(4px,0.8vmin,8px)] h-[clamp(4px,0.8vmin,8px)] rounded-full bg-slate-300 shadow-inner"></div>
             <div className="w-[clamp(4px,0.8vmin,8px)] h-[clamp(4px,0.8vmin,8px)] rounded-full bg-slate-300 shadow-inner"></div>
        </div>

        <FlipUnit key="seconds" digit={time.getSeconds()} label={t('clock_seconds', lang)} />
        {use12Hour && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-[clamp(42px,5.4vmin,110px)] h-[clamp(56px,7vmin,130px)] bg-[#121212] rounded-xl shadow-[0_10px_20px_rgba(0,0,0,0.8)] border border-white/5 flex items-center justify-center">
              <span className="text-[clamp(1rem,2.6vmin,2.6rem)] font-bold text-slate-200">{meridiem}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default FlipClock;
