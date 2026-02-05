import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';

interface SeasonalEffectsProps {
  effect: 'none' | 'snow' | 'leaves' | 'blossom' | 'fireflies';
}

const SeasonalEffects: React.FC<SeasonalEffectsProps> = ({ effect }) => {
  if (!effect || effect === 'none') return null;

  // Generate stable random values for each effect type
  const snowFlakes = useMemo(() => [...Array(20)].map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: -Math.random() * 10, // Negative delay for immediate start
    duration: Math.random() * 3 + 3,
    innerDelay: -Math.random() * 10
  })), []);

  const leaves = useMemo(() => [...Array(15)].map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    fontSize: Math.random() * 0.7 + 0.5,
    delay: -Math.random() * 15, // Negative delay for immediate start
    duration: Math.random() * 5 + 10,
    opacity: Math.random() * 0.5 + 0.4,
    type: i % 2 === 0 ? '🍁' : '🍂'
  })), []);

  const blossoms = useMemo(() => [...Array(15)].map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    fontSize: Math.random() * 0.6 + 0.5,
    delay: -Math.random() * 15, // Negative delay for immediate start
    duration: Math.random() * 5 + 8
  })), []);

  const fireflies = useMemo(() => [...Array(20)].map((_, i) => ({
    id: i,
    top: Math.random() * 100,
    left: Math.random() * 100,
    delay: -Math.random() * 20, // Negative delay for immediate start
    moveDuration: Math.random() * 10 + 15,
    flashDuration: Math.random() * 2 + 2
  })), []);

  const content = (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden" aria-hidden="true">
      <style>{`
        /* SNOW */
        .snowflake {
          color: #fff;
          font-size: 1em;
          font-family: Arial, sans-serif;
          text-shadow: 0 0 5px #000;
          position: fixed;
          top: -10%;
          z-index: 9999;
          user-select: none;
          cursor: default;
          animation-name: snowflakes-shake;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-play-state: running;
        }
        .snowflake .inner {
          animation-name: snowflakes-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-play-state: running;
        }
        @keyframes snowflakes-fall {
          0% { transform: translateY(0); }
          100% { transform: translateY(110vh); }
        }
        @keyframes snowflakes-shake {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(80px); }
        }
        
        /* LEAVES */
        .leaf {
          position: fixed;
          top: -10%;
          z-index: 9999;
          user-select: none;
          cursor: default;
          animation-name: leaf-fall, leaf-shake;
          animation-timing-function: linear, ease-in-out;
          animation-iteration-count: infinite;
          animation-play-state: running;
        }
        @keyframes leaf-fall {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(110vh) rotate(360deg); }
        }
        @keyframes leaf-shake {
          0%, 100% { margin-left: 0; }
          50% { margin-left: 60px; }
        }

        /* BLOSSOM */
        .petal {
          position: fixed;
          top: -10%;
          z-index: 9999;
          user-select: none;
          cursor: default;
          color: #ffb7b2;
          text-shadow: 0 0 2px #ff9e99;
          animation-name: petal-fall, petal-sway;
          animation-timing-function: linear, ease-in-out;
          animation-iteration-count: infinite;
          animation-play-state: running;
        }
        @keyframes petal-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(180deg); opacity: 0; }
        }
        @keyframes petal-sway {
          0%, 100% { margin-left: 0; }
          50% { margin-left: 40px; }
        }

        /* FIREFLIES */
        .firefly {
          position: fixed;
          width: 4px;
          height: 4px;
          background-color: #ffff00;
          border-radius: 50%;
          box-shadow: 0 0 10px #ffff00, 0 0 20px #ffff00;
          opacity: 0;
          animation: firefly-move infinite alternate, firefly-flash infinite;
        }
        @keyframes firefly-move {
          0% { transform: translate(0, 0); }
          20% { transform: translate(10vw, -10vh); }
          40% { transform: translate(-5vw, 15vh); }
          60% { transform: translate(-15vw, -5vh); }
          80% { transform: translate(5vw, 10vh); }
          100% { transform: translate(0, 0); }
        }
        @keyframes firefly-flash {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.8; }
        }
      `}</style>

      {effect === 'snow' && (
        <div className="snowflakes">
          {snowFlakes.map((flake) => (
            <div key={flake.id} className="snowflake" style={{ 
              left: `${flake.left}%`, 
              animationDelay: `${flake.delay}s`,
              animationDuration: `${flake.duration}s`
            }}>
              <div className="inner" style={{ 
                animationDelay: `${flake.innerDelay}s`,
                animationDuration: '10s'
              }}>❅</div>
            </div>
          ))}
        </div>
      )}

      {effect === 'leaves' && (
        <div className="leaves">
          {leaves.map((leaf) => (
            <div key={leaf.id} className="leaf" style={{ 
              left: `${leaf.left}%`, 
              fontSize: `${leaf.fontSize}rem`,
              animationDelay: `${leaf.delay}s, ${leaf.delay}s`, // Apply delay to both animations
              animationDuration: `${leaf.duration}s, 4s`,
              opacity: leaf.opacity
            }}>
              {leaf.type}
            </div>
          ))}
        </div>
      )}

      {effect === 'blossom' && (
        <div className="blossoms">
          {blossoms.map((petal) => (
            <div key={petal.id} className="petal" style={{ 
              left: `${petal.left}%`, 
              fontSize: `${petal.fontSize}rem`,
              animationDelay: `${petal.delay}s, ${petal.delay}s`,
              animationDuration: `${petal.duration}s, 3s`
            }}>
              🌸
            </div>
          ))}
        </div>
      )}

      {effect === 'fireflies' && (
        <div className="fireflies">
          {fireflies.map((fly) => (
            <div key={fly.id} className="firefly" style={{ 
              top: `${fly.top}vh`,
              left: `${fly.left}vw`,
              animationDelay: `${fly.delay}s, ${fly.delay}s`,
              animationDuration: `${fly.moveDuration}s, ${fly.flashDuration}s`
            }}></div>
          ))}
        </div>
      )}
    </div>
  );

  if (typeof document === 'undefined') {
    return content;
  }

  return createPortal(content, document.body);
};

export default SeasonalEffects;
