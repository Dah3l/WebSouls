import { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, InputState } from './game/types';
import { createInitialState, updateGame } from './game/engine';
import { renderGame } from './game/renderer';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>({
    keys: new Set(),
    mouseDown: false,
    rightMouseDown: false,
    mouseX: 0,
    mouseY: 0,
    attackPressed: false,
    dodgePressed: false,
  });
  const animFrameRef = useRef<number>(0);
  const canvasSizeRef = useRef({ width: 800, height: 500 });
  const [phase, setPhase] = useState<'menu' | 'playing' | 'dead' | 'victory'>('menu');
  const [deaths, setDeaths] = useState(0);
  const [souls, setSouls] = useState(0);
  const gameStartedRef = useRef(false);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    canvas.width = width;
    canvas.height = height;
    canvasSizeRef.current = { width, height };
  }, []);

  const startGame = useCallback(() => {
    resizeCanvas();
    gameStateRef.current = createInitialState();
    gameStartedRef.current = true;
    setPhase('playing');
    setDeaths(0);
    setSouls(0);
  }, [resizeCanvas]);

  const restartGame = useCallback(() => {
    const state = gameStateRef.current;
    const prevDeaths = state ? state.deaths + (state.phase === 'dead' ? 1 : 0) : deaths;
    resizeCanvas();
    gameStateRef.current = createInitialState();
    gameStateRef.current.deaths = prevDeaths;
    gameStartedRef.current = true;
    setPhase('playing');
    setDeaths(prevDeaths);
    setSouls(0);
  }, [deaths, resizeCanvas]);

  // Resize handler
  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clearInput = () => {
      const input = inputRef.current;
      input.keys.clear();
      input.mouseDown = false;
      input.rightMouseDown = false;
      input.attackPressed = false;
      input.dodgePressed = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const input = inputRef.current;
      const key = e.key;
      
      // Prevent default for game keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift'].includes(e.code) || 
          key === ' ') {
        e.preventDefault();
      }
      
      if (!input.keys.has(key)) {
        if (key === ' ' || e.code === 'Space') {
          input.attackPressed = true;
        }
        if (key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          input.dodgePressed = true;
        }
      }
      
      input.keys.add(key);
      
      if (key === 'r' || key === 'R') {
        const state = gameStateRef.current;
        if (state && (state.phase === 'dead' || state.phase === 'victory')) {
          restartGame();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      inputRef.current.keys.delete(e.key);
      // Also delete by code for shift keys
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        inputRef.current.keys.delete('Shift');
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      if (e.button === 0) {
        inputRef.current.mouseDown = true;
        inputRef.current.attackPressed = true;
      }
      if (e.button === 2) {
        inputRef.current.rightMouseDown = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) inputRef.current.mouseDown = false;
      if (e.button === 2) inputRef.current.rightMouseDown = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      inputRef.current.mouseX = e.clientX - rect.left;
      inputRef.current.mouseY = e.clientY - rect.top;
    };

    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    const handleBlur = () => {
      // Clear all inputs when window loses focus
      clearInput();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('contextmenu', handleContextMenu);

    let lastTime = performance.now();

    const gameLoop = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - lastTime) / 16.67, 3);
      lastTime = currentTime;

      const state = gameStateRef.current;
      const { width, height } = canvasSizeRef.current;
      
      if (state && gameStartedRef.current) {
        if (state.phase === 'playing') {
          updateGame(state, inputRef.current, deltaTime);
        } else {
          state.gameTime += deltaTime;
          state.bonfire.animTimer += deltaTime;
          state.particles = state.particles.filter(p => {
            p.pos.x += p.vel.x;
            p.pos.y += p.vel.y;
            p.vel.y += 0.1;
            p.life--;
            return p.life > 0;
          });
          state.damageNumbers = state.damageNumbers.filter(d => {
            d.pos.y -= 1;
            d.life -= deltaTime;
            return d.life > 0;
          });
        }
        
        if (state.phase !== phase) {
          setPhase(state.phase);
          if (state.phase === 'dead') {
            setDeaths(state.deaths);
          }
          setSouls(state.souls);
        }

        renderGame(ctx, state, width, height);
      } else {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, width, height);
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [phase, restartGame]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-screen bg-black overflow-hidden select-none fixed inset-0"
    >
      {phase === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gradient-to-b from-[#0a0a15] via-[#12121f] to-[#0a0a0f]">
          <div className="mb-8 text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-[#8b6914] tracking-wider mb-2"
                style={{ textShadow: '0 0 20px rgba(139, 105, 20, 0.5), 0 4px 8px rgba(0,0,0,0.8)' }}>
              PIXEL SOULS
            </h1>
            <p className="text-[#555566] text-sm tracking-widest uppercase">
              A Dark Pixel Adventure
            </p>
          </div>

          <div className="relative w-20 h-24 mb-8">
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-10 h-5 bg-[#444455] rounded-sm"></div>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-1.5 h-14 bg-[#666677]"></div>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-4 h-3 bg-[#555566]"></div>
            <div className="absolute bottom-7 left-1/2 -translate-x-1/2 w-8 h-10 animate-pulse"
                 style={{
                   background: 'radial-gradient(ellipse at bottom, #ff4400, #ff7700 40%, #ffaa00 70%, transparent)',
                   borderRadius: '50% 50% 20% 20%',
                   filter: 'blur(1px)',
                 }}>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 opacity-20"
                 style={{
                   background: 'radial-gradient(circle, rgba(255,120,30,0.5), transparent 70%)',
                 }}>
            </div>
          </div>

          <button
            onClick={startGame}
            className="px-8 py-3 bg-[#1a1a2a] border-2 border-[#8b6914] text-[#ccaa44] font-mono text-lg 
                       hover:bg-[#2a2a3a] hover:border-[#ccaa44] hover:text-[#ffdd66] transition-all duration-300
                       focus:outline-none focus:ring-2 focus:ring-[#8b6914] cursor-pointer"
          >
            BEGIN JOURNEY
          </button>

          <div className="mt-10 text-center text-[#444455] font-mono text-xs space-y-1.5">
            <p className="text-[#666677] mb-3 text-sm">— Controls —</p>
            <p><span className="text-[#888899]">WASD / Arrows</span> — Move</p>
            <p><span className="text-[#888899]">SPACE / Left Click</span> — Attack</p>
            <p><span className="text-[#888899]">SHIFT</span> — Dodge Roll (i-frames)</p>
            <p><span className="text-[#888899]">Right Click</span> — Block</p>
            <p><span className="text-[#888899]">E</span> — Rest at Bonfire</p>
          </div>

          <div className="absolute bottom-4 text-[#333340] font-mono text-xs">
            Defeat the Fallen King to achieve victory
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ 
          imageRendering: 'pixelated',
          display: phase === 'menu' ? 'none' : 'block',
        }}
      />

      {(phase === 'dead' || phase === 'victory') && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={restartGame}
            className="px-6 py-2 bg-[#1a1a2a] border border-[#8b6914] text-[#ccaa44] font-mono text-sm
                       hover:bg-[#2a2a3a] hover:text-[#ffdd66] transition-all duration-300 cursor-pointer"
          >
            {phase === 'dead' ? '⟳ RISE AGAIN (R)' : '⟳ NEW JOURNEY (R)'}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
