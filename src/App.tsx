/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Play, Settings, Bot, BarChart2, X, ChevronRight, ChevronDown, Volume2, VolumeX, Music } from 'lucide-react';
import { GRID_SIZE, SHAPES, COLORS } from './constants';
import { Grid, Shape, Position } from './types';
import { audioService, BGM_TRACKS } from './services/audioService';

interface DDAConfig {
  thresholds: {
    veryCrowded: number;
    crowded: number;
    plenty: number;
  };
  probs: {
    veryCrowded: { small: number; medium: number; large: number };
    crowded: { small: number; medium: number; large: number };
    normal: { small: number; medium: number; large: number };
    plenty: { small: number; medium: number; large: number };
  };
  lifesaverEnabled: boolean;
}

const DEFAULT_DDA_CONFIG: DDAConfig = {
  thresholds: {
    veryCrowded: 0.2,
    crowded: 0.4,
    plenty: 0.6,
  },
  probs: {
    veryCrowded: { small: 0.7, medium: 0.3, large: 0 },
    crowded: { small: 0.5, medium: 0.4, large: 0.1 },
    normal: { small: 0.33, medium: 0.34, large: 0.33 },
    plenty: { small: 0.2, medium: 0.3, large: 0.5 },
  },
  lifesaverEnabled: true,
};

const createEmptyGrid = () => Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
}

const SPEED_STEPS = [
  { label: '1x', delay: 500, restart: 1500 },
  { label: '2x', delay: 100, restart: 1000 },
  { label: '5x', delay: 10, restart: 100 },
  { label: 'MAX', delay: 1, restart: 10 }
];

export default function App() {
  const [grid, setGrid] = useState<Grid>(createEmptyGrid());
  const [particles, setParticles] = useState<Particle[]>([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('block-blast-highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [tray, setTray] = useState<Shape[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [clearingLines, setClearingLines] = useState<{ rows: number[], cols: number[] }>({ rows: [], cols: [] });
  const [comboCount, setComboCount] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string, id: number } | null>(null);
  const [lastPlacement, setLastPlacement] = useState<{ pos: Position, shape: Shape, score: number, id: number } | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [bgmIndex, setBgmIndex] = useState(0);
  const clearingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const placementTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shakeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Simulation / Debug State
  const [showSimPanel, setShowSimPanel] = useState(false);
  const [ddaConfig, setDdaConfig] = useState<DDAConfig>(() => {
    const saved = localStorage.getItem('block-blast-dda-config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_DDA_CONFIG;
      }
    }
    return DEFAULT_DDA_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('block-blast-dda-config', JSON.stringify(ddaConfig));
  }, [ddaConfig]);

  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const currentSpeed = SPEED_STEPS[speedIndex];
  const [simStats, setSimStats] = useState({ gamesPlayed: 0, totalScore: 0, avgScore: 0 });
  const [currentRemainingPercent, setCurrentRemainingPercent] = useState(1);

  const gridRef = useRef<HTMLDivElement>(null);
  const cachedGridRect = useRef<DOMRect | null>(null);

  // Check if a shape can be placed at a specific position
  const canPlace = useCallback((shape: Shape, pos: Position, currentGrid: Grid): boolean => {
    for (let r = 0; r < shape.cells.length; r++) {
      for (let c = 0; c < shape.cells[r].length; c++) {
        if (shape.cells[r][c] === 1) {
          const gridR = pos.y + r;
          const gridC = pos.x + c;

          if (
            gridR < 0 || gridR >= GRID_SIZE ||
            gridC < 0 || gridC >= GRID_SIZE ||
            !currentGrid[gridR] ||
            currentGrid[gridR][gridC] !== 0
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }, []);

  // Generate 3 random shapes for the tray with dynamic difficulty adjustment
  const generateTray = useCallback((currentGrid: Grid = grid) => {
    const totalCells = GRID_SIZE * GRID_SIZE;
    let occupiedCells = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (currentGrid[r][c] !== 0) occupiedCells++;
      }
    }
    const remainingPercent = (totalCells - occupiedCells) / totalCells;
    setCurrentRemainingPercent(remainingPercent);

    // Define probabilities based on config
    let probs = ddaConfig.probs.normal;
    if (remainingPercent < ddaConfig.thresholds.veryCrowded) {
      probs = ddaConfig.probs.veryCrowded;
    } else if (remainingPercent < ddaConfig.thresholds.crowded) {
      probs = ddaConfig.probs.crowded;
    } else if (remainingPercent > ddaConfig.thresholds.plenty) {
      probs = ddaConfig.probs.plenty;
    }

    const getRandomShapeByWeight = () => {
      const rand = Math.random();
      let targetSize: 'small' | 'medium' | 'large' = 'medium';
      if (rand < probs.small) targetSize = 'small';
      else if (rand < probs.small + probs.medium) targetSize = 'medium';
      else targetSize = 'large';

      const filteredShapes = SHAPES.filter(s => s.size === targetSize);
      const pool = filteredShapes.length > 0 ? filteredShapes : SHAPES;
      return { ...pool[Math.floor(Math.random() * pool.length)] };
    };

    const newTray: Shape[] = [];
    let hasPlacable = false;

    for (let i = 0; i < 3; i++) {
      let shape: Shape;
      
      // Lifesaver Logic
      if (ddaConfig.lifesaverEnabled && i === 2 && !hasPlacable) {
        const placableShapes = SHAPES.filter(s => {
          for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
              if (canPlace(s, { x: c, y: r }, currentGrid)) return true;
            }
          }
          return false;
        });

        if (placableShapes.length > 0) {
          shape = { ...placableShapes[Math.floor(Math.random() * placableShapes.length)] };
        } else {
          shape = getRandomShapeByWeight();
        }
      } else {
        shape = getRandomShapeByWeight();
      }

      // Check if this shape is placable
      if (!hasPlacable) {
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (canPlace(shape, { x: c, y: r }, currentGrid)) {
              hasPlacable = true;
              break;
            }
          }
          if (hasPlacable) break;
        }
      }

      shape.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      newTray.push({ ...shape, id: `${shape.id}-${Date.now()}-${i}` });
    }

    setTray(newTray);
    return newTray;
  }, [grid, canPlace, ddaConfig]);

  const startGame = () => {
    // Clear any pending timeouts and force immediate state reset
    if (clearingTimeoutRef.current) clearTimeout(clearingTimeoutRef.current);
    if (placementTimeoutRef.current) clearTimeout(placementTimeoutRef.current);
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    
    clearingTimeoutRef.current = null;
    placementTimeoutRef.current = null;
    shakeTimeoutRef.current = null;
    feedbackTimeoutRef.current = null;
    
    audioService.play('click');
    audioService.startBGM();
    const newGrid = createEmptyGrid();
    setGrid(newGrid);
    setScore(0);
    setComboCount(0);
    setFeedback(null);
    setGameOver(false);
    setGameStarted(true);
    setActiveShape(null);
    setActivePos(null);
    setLastPlacement(null);
    setClearingLines({ rows: [], cols: [] });
    generateTray(newGrid);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clearingTimeoutRef.current) clearTimeout(clearingTimeoutRef.current);
      if (placementTimeoutRef.current) clearTimeout(placementTimeoutRef.current);
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const toggleMute = () => {
    const muted = audioService.toggleMute();
    setIsMuted(muted);
  };

  const toggleBgmTrack = () => {
    const nextIndex = (bgmIndex + 1) % BGM_TRACKS.length;
    setBgmIndex(nextIndex);
    audioService.setTrack(nextIndex);
  };

  useEffect(() => {
    const handleFirstClick = () => {
      if (gameStarted) {
        audioService.startBGM();
      }
    };
    window.addEventListener('click', handleFirstClick);
    return () => window.removeEventListener('click', handleFirstClick);
  }, [gameStarted]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('block-blast-highscore', score.toString());
    }
  }, [score, highScore]);

  // Check if any shape in the tray can be placed anywhere on the grid
  const checkGameOver = useCallback((currentTray: Shape[], currentGrid: Grid) => {
    if (currentTray.length === 0) return false;

    for (const shape of currentTray) {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (canPlace(shape, { x: c, y: r }, currentGrid)) {
            return false;
          }
        }
      }
    }
    return true;
  }, []);

  const handlePlace = (shape: Shape, pos: Position) => {
    // If there's a pending line clear, finish it immediately before placing a new block
    // This prevents state conflicts and "ghost" blocks
    if (clearingTimeoutRef.current) {
      clearTimeout(clearingTimeoutRef.current);
      // We need to manually apply the clear that was pending
      // But since we don't easily have the pending clearedGrid here without complex state,
      // the safest way is to ensure the grid is in its final "cleared" state.
      // However, handlePlace is usually called after a delay, so we can just let it be
      // OR we can force the state reset.
      setClearingLines({ rows: [], cols: [] });
      clearingTimeoutRef.current = null;
    }

    if (!canPlace(shape, pos, grid)) return false;

    // Reset active preview state immediately on successful placement
    setActiveShape(null);
    setActivePos(null);

    let blocksPlaced = 0;
    const newGrid = grid.map(row => [...row]);
    
    for (let r = 0; r < shape.cells.length; r++) {
      for (let c = 0; c < shape.cells[r].length; c++) {
        if (shape.cells[r][c] === 1) {
          newGrid[pos.y + r][pos.x + c] = shape.color;
          blocksPlaced++;
        }
      }
    }

    // Trigger landing effects
    audioService.play('place');
    const placement = { pos, shape, score: blocksPlaced, id: Date.now() };
    setLastPlacement(placement);
    
    if (placementTimeoutRef.current) clearTimeout(placementTimeoutRef.current);
    placementTimeoutRef.current = setTimeout(() => {
      setLastPlacement(null);
      placementTimeoutRef.current = null;
    }, 500);

    // Calculate score for placement
    let newScore = score + blocksPlaced;

    // Check for full rows and columns
    const fullRows: number[] = [];
    const fullCols: number[] = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      if (newGrid[r].every(cell => cell !== 0)) {
        fullRows.push(r);
      }
    }

    for (let c = 0; c < GRID_SIZE; c++) {
      let isFull = true;
      for (let r = 0; r < GRID_SIZE; r++) {
        if (newGrid[r][c] === 0) {
          isFull = false;
          break;
        }
      }
      if (isFull) {
        fullCols.push(c);
      }
    }

    const nextTray = tray.filter(s => s.id !== shape.id);

    if (fullRows.length > 0 || fullCols.length > 0) {
      // Trigger shake only on line clear
      setIsShaking(true);
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      shakeTimeoutRef.current = setTimeout(() => {
        setIsShaking(false);
        shakeTimeoutRef.current = null;
      }, 200);

      const linesCleared = fullRows.length + fullCols.length;
      const newCombo = comboCount + 1;
      setComboCount(newCombo);

      // Calculate bonus
      let bonus = 0;
      let feedbackText = "";

      // Multi-line bonus
      if (linesCleared === 1) { bonus = 10; feedbackText = "GOOD!"; }
      else if (linesCleared === 2) { bonus = 30; feedbackText = "GREAT!"; }
      else if (linesCleared === 3) { bonus = 60; feedbackText = "AMAZING!"; }
      else { bonus = 100; feedbackText = "PERFECT!"; }

      // Combo bonus
      if (newCombo > 1) {
        bonus += newCombo * 20;
        feedbackText = `${feedbackText} COMBO x${newCombo}`;
      }

      newScore += bonus;
      setFeedback({ text: feedbackText, id: Date.now() });
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback(null);
        feedbackTimeoutRef.current = null;
      }, 2000);
      
      const pitch = Math.min(1.0 + (linesCleared - 1) * 0.15, 2.0);
      audioService.play('clear', pitch);
      
      if (newCombo > 1) {
        setTimeout(() => {
          const comboPitch = Math.min(1.0 + (newCombo - 2) * 0.1, 2.0);
          audioService.play('combo', comboPitch);
        }, 200);
      }

      // Generate particles
      const clearedCells = new Set<string>();
      fullRows.forEach(r => {
        for (let c = 0; c < GRID_SIZE; c++) {
          clearedCells.add(`${r},${c}`);
        }
      });
      fullCols.forEach(c => {
        for (let r = 0; r < GRID_SIZE; r++) {
          clearedCells.add(`${r},${c}`);
        }
      });

      const newParticles: Particle[] = [];
      let particleId = Date.now();
      
      clearedCells.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        const cellColor = newGrid[r][c];
        if (cellColor !== 0) {
          const x = (c + 0.5) * (100 / GRID_SIZE);
          const y = (r + 0.5) * (100 / GRID_SIZE);
          for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 80 + 30;
            newParticles.push({
              id: particleId++,
              x,
              y,
              color: cellColor.toString(),
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              rotation: Math.random() * 360
            });
          }
        }
      });
      
      setParticles(prev => [...prev, ...newParticles]);

      setGrid([...newGrid]);
      setClearingLines({ rows: fullRows, cols: fullCols });
      
      // Remove from tray immediately
      setTray(nextTray);
      
      if (clearingTimeoutRef.current) clearTimeout(clearingTimeoutRef.current);
      clearingTimeoutRef.current = setTimeout(() => {
        const clearedGrid = newGrid.map((row, r) => 
          row.map((cell, c) => {
            if (fullRows.includes(r) || fullCols.includes(c)) {
              return 0;
            }
            return cell;
          })
        );
        
        setGrid(clearedGrid);
        setClearingLines({ rows: [], cols: [] });
        
        if (nextTray.length === 0) {
          // Generate new tray and check game over with the new tray
          const newTray = generateTray(clearedGrid);
          if (checkGameOver(newTray, clearedGrid)) {
            setGameOver(true);
            audioService.play('gameOver');
          }
        } else {
          // Check game over with current remaining tray
          if (checkGameOver(nextTray, clearedGrid)) {
            setGameOver(true);
            audioService.play('gameOver');
          }
        }
        clearingTimeoutRef.current = null;
      }, 400);
    } else {
      setComboCount(0); // Reset combo if no lines cleared
      setGrid([...newGrid]);
      setTray(nextTray);
      if (nextTray.length === 0) {
        // Generate new tray and check game over
        const newTray = generateTray(newGrid);
        if (checkGameOver(newTray, newGrid)) {
          setGameOver(true);
          audioService.play('gameOver');
        }
      } else {
        if (checkGameOver(nextTray, newGrid)) {
          setGameOver(true);
          audioService.play('gameOver');
        }
      }
    }

    setScore(newScore);
    return true;
  };

  useEffect(() => {
    if (gameOver && isAutoPlaying) {
      // Update stats and restart
      setSimStats(prev => {
        const newGames = prev.gamesPlayed + 1;
        const newTotal = prev.totalScore + score;
        return {
          gamesPlayed: newGames,
          totalScore: newTotal,
          avgScore: Math.round(newTotal / newGames)
        };
      });
      setTimeout(startGame, currentSpeed.restart);
    }
  }, [gameOver, isAutoPlaying, score, currentSpeed]);

  // Auto-Play Bot Heuristic
  useEffect(() => {
    if (!isAutoPlaying || gameOver || !gameStarted || tray.length === 0 || clearingLines.rows.length > 0 || clearingLines.cols.length > 0) return;

    const timer = setTimeout(() => {
      // Simple Heuristic: Find move that clears most lines, then most blocks
      let bestMove: { shape: Shape, pos: Position, value: number } | null = null;

      for (const shape of tray) {
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const pos = { x: c, y: r };
            if (canPlace(shape, pos, grid)) {
              // Calculate potential cleared lines
              const tempGrid = grid.map(row => [...row]);
              let blocks = 0;
              for (let sr = 0; sr < shape.cells.length; sr++) {
                for (let sc = 0; sc < shape.cells[sr].length; sc++) {
                  if (shape.cells[sr][sc] === 1) {
                    tempGrid[r + sr][c + sc] = 1;
                    blocks++;
                  }
                }
              }
              
              let lines = 0;
              for (let gr = 0; gr < GRID_SIZE; gr++) {
                if (tempGrid[gr].every(cell => cell !== 0)) lines++;
              }
              for (let gc = 0; gc < GRID_SIZE; gc++) {
                let full = true;
                for (let gr = 0; gr < GRID_SIZE; gr++) {
                  if (tempGrid[gr][gc] === 0) { full = false; break; }
                }
                if (full) lines++;
              }

              const value = (lines * 100) + blocks;
              if (!bestMove || value > bestMove.value) {
                bestMove = { shape, pos, value };
              }
            }
          }
        }
      }

      if (bestMove) {
        handlePlace(bestMove.shape, bestMove.pos);
      }
    }, currentSpeed.delay);

    return () => clearTimeout(timer);
  }, [isAutoPlaying, gameOver, gameStarted, tray, grid, canPlace, handlePlace, clearingLines, currentSpeed]);

  const [activeShape, setActiveShape] = useState<Shape | null>(null);
  const [activePos, setActivePos] = useState<Position | null>(null);

  // Memoize the validity of the current active position
  const isValidPlacement = React.useMemo(() => {
    if (!activeShape || !activePos) return false;
    return canPlace(activeShape, activePos, grid);
  }, [activeShape, activePos, grid, canPlace]);

  const handleDrag = useCallback((shape: Shape, event: any, info: any) => {
    if (!gridRef.current || !cachedGridRect.current || !info.grabOffset) return;

    const gridRect = cachedGridRect.current;
    const padding = 4;
    const cellSize = (gridRect.width - padding * 2) / GRID_SIZE;

    // Calculate the actual visual center of the block based on the grab offset
    // This ensures the preview is always perfectly aligned with the dragged block
    const visualCenterX = info.point.x - info.grabOffset.x - gridRect.left - padding;
    const visualCenterY = info.point.y - info.grabOffset.y - gridRect.top - padding;

    // Map the visual center to grid coordinates
    const gridX = Math.round((visualCenterX / cellSize) - (shape.cells[0].length / 2));
    const gridY = Math.round((visualCenterY / cellSize) - (shape.cells.length / 2));

    if (gridX >= -1 && gridX < GRID_SIZE && 
        gridY >= -1 && gridY < GRID_SIZE) {
      setActiveShape(shape);
      setActivePos({ x: gridX, y: gridY });
    } else {
      setActivePos(null);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    if (activeShape && activePos) {
      handlePlace(activeShape, activePos);
    }
    setActiveShape(null);
    setActivePos(null);
  }, [activeShape, activePos, handlePlace]);

  // Helper to check if a cell is part of the active preview
  const isPreviewCell = (r: number, c: number) => {
    if (!activeShape || !activePos) return false;
    const shapeR = r - activePos.y;
    const shapeC = c - activePos.x;
    return (
      shapeR >= 0 && shapeR < activeShape.cells.length &&
      shapeC >= 0 && shapeC < activeShape.cells[0].length &&
      activeShape.cells[shapeR][shapeC] === 1
    );
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-start sm:justify-center py-4 px-2 sm:p-4 bg-[#121212] select-none overflow-hidden touch-none">
      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center mb-4 sm:mb-8">
        {/* Title & High Score */}
        <div className="flex-1 flex justify-start">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white leading-none">BLOCK<br/>BLAST</h1>
            <div className="flex items-center gap-2 text-yellow-500 mt-2">
              <Trophy size={16} />
              <span className="text-sm font-bold uppercase tracking-widest">{highScore}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 px-2 shrink-0">
          <button 
            onClick={() => setShowSimPanel(true)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors flex items-center justify-center"
            title="Simulation Settings"
          >
            <Settings size={20} />
          </button>
          <button 
            onClick={toggleBgmTrack}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors relative group flex items-center justify-center"
            title={`Music: ${BGM_TRACKS[bgmIndex].name}`}
          >
            <Music size={20} />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {BGM_TRACKS[bgmIndex].name}
            </span>
          </button>
          <button 
            onClick={toggleMute}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors flex items-center justify-center"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>

        {/* Score */}
        <div className="flex-1 flex justify-end">
          <div className="bg-[#1e1e1e] min-w-[80px] px-4 py-2 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden flex flex-col items-center justify-center">
            <span className="block text-[10px] uppercase tracking-widest text-white/40 font-bold mb-0.5 text-center">Score</span>
            <span className="block text-2xl font-black text-white tabular-nums text-center leading-none">{score}</span>
            
            {/* Combo Indicator */}
            <AnimatePresence>
              {comboCount > 1 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-500 shadow-[0_0_10px_#eab308]"
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Combo/Feedback Floating Text */}
      <div className="h-6 sm:h-8 mb-1 sm:mb-2 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {feedback && (
            <motion.div
              key={feedback.id}
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.5, y: -20 }}
              onAnimationComplete={() => {}}
              className="text-xl font-black italic tracking-tighter text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]"
            >
              {feedback.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Grid */}
      <div className="relative">
        <div 
          ref={gridRef}
          className={`grid-container w-[300px] h-[300px] xs:w-[340px] xs:h-[340px] sm:w-[400px] sm:h-[400px] ${isShaking ? 'animate-shake' : ''}`}
        >
          {grid.map((row, r) => (
            row.map((cell, c) => {
              const isPreview = isPreviewCell(r, c);
              const isClearing = clearingLines.rows.includes(r) || clearingLines.cols.includes(c);
              
              const isJustPlaced = !isClearing && lastPlacement && cell !== 0 &&
                r >= lastPlacement.pos.y && r < lastPlacement.pos.y + lastPlacement.shape.cells.length &&
                c >= lastPlacement.pos.x && c < lastPlacement.pos.x + lastPlacement.shape.cells[0].length &&
                lastPlacement.shape.cells[r - lastPlacement.pos.y][c - lastPlacement.pos.x] === 1;
              
              let previewClasses = "";
              if (isPreview) {
                if (isValidPlacement) {
                  previewClasses = `${activeShape?.color} opacity-40 ring-4 ring-white/50 z-20`;
                } else {
                  previewClasses = "bg-red-600 opacity-80 ring-4 ring-red-500 z-20";
                }
              }
              
              return (
                <div 
                  key={`${r}-${c}`} 
                  className={`grid-cell ${cell !== 0 ? cell : ''} ${previewClasses} ${isClearing ? 'animate-clear z-30' : ''} ${isJustPlaced ? 'animate-place z-10' : ''}`}
                />
              );
            })
          ))}
        </div>

        {/* Particles */}
        <AnimatePresence>
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ x: "-50%", y: "-50%", scale: 1, opacity: 1, rotate: 0 }}
              animate={{ 
                x: `calc(-50% + ${p.vx}px)`, 
                y: `calc(-50% + ${p.vy}px)`, 
                scale: 0, 
                opacity: 0,
                rotate: p.rotation 
              }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={`absolute w-3 h-3 sm:w-4 sm:h-4 rounded-sm shadow-lg ${p.color}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, pointerEvents: 'none', zIndex: 50 }}
              onAnimationComplete={() => setParticles(prev => prev.filter(particle => particle.id !== p.id))}
            />
          ))}
        </AnimatePresence>

        {/* Floating Score Popups */}
        <AnimatePresence>
          {lastPlacement && (
            <motion.div
              key={lastPlacement.id}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: -40 }}
              exit={{ opacity: 0 }}
              style={{ 
                position: 'absolute',
                left: `${(lastPlacement.pos.x + lastPlacement.shape.cells[0].length / 2) * (100 / GRID_SIZE)}%`,
                top: `${(lastPlacement.pos.y + lastPlacement.shape.cells.length / 2) * (100 / GRID_SIZE)}%`,
              }}
              className="pointer-events-none text-white font-black text-lg drop-shadow-lg z-50"
            >
              +{lastPlacement.score}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Simulation Panel */}
      <AnimatePresence>
        {showSimPanel && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed inset-y-0 right-0 w-80 bg-[#1a1a1a] border-l border-white/10 z-[100] shadow-2xl overflow-y-auto p-6"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-white flex items-center gap-2 italic">
                <Settings size={20} /> SIMULATION
              </h2>
              <button onClick={() => setShowSimPanel(false)} className="text-white/40 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-8">
              {/* Bot Control */}
              <section>
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Bot size={14} /> Bot Control
                </h3>
                <button 
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isAutoPlaying ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'}`}
                >
                  {isAutoPlaying ? 'STOP AUTO-PLAY' : 'START AUTO-PLAY'}
                </button>
                
                <div className="mt-4 flex gap-2">
                  <div className="flex-1 flex bg-white/5 rounded-lg p-1">
                    {SPEED_STEPS.map((step, idx) => (
                      <button
                        key={step.label}
                        onClick={() => setSpeedIndex(idx)}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors ${speedIndex === idx ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/80'}`}
                      >
                        {step.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSimStats({ gamesPlayed: 0, totalScore: 0, avgScore: 0 })}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
                  >
                    RESET
                  </button>
                </div>

                <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-white/40">Games Played</span>
                    <span className="text-white font-mono">{simStats.gamesPlayed}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">Avg Score</span>
                    <span className="text-white font-mono">{simStats.avgScore}</span>
                  </div>
                </div>
              </section>

              {/* DDA Config */}
              <section>
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <BarChart2 size={14} /> DDA Configuration
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] text-white/40 uppercase mb-2">Thresholds (Remaining %)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(ddaConfig.thresholds).map(([key, val]) => (
                        <div key={key} className="bg-white/5 p-2 rounded-lg border border-white/5">
                          <span className="block text-[8px] text-white/30 truncate">{key}</span>
                          <input 
                            type="number" 
                            step="0.1" 
                            value={val} 
                            onChange={(e) => setDdaConfig(prev => ({ ...prev, thresholds: { ...prev.thresholds, [key]: parseFloat(e.target.value) } }))}
                            className="w-full bg-transparent text-white text-xs font-mono outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-white/40 uppercase mb-2">Probabilities (S / M / L)</label>
                    {Object.entries(ddaConfig.probs).map(([state, p]) => (
                      <div key={state} className="mb-3 last:mb-0">
                        <span className="block text-[9px] text-white/30 mb-1 capitalize">{state}</span>
                        <div className="grid grid-cols-3 gap-2">
                          {Object.entries(p).map(([size, val]) => (
                            <input 
                              key={size}
                              type="number" 
                              step="0.05" 
                              value={val} 
                              onChange={(e) => setDdaConfig(prev => ({ 
                                ...prev, 
                                probs: { 
                                  ...prev.probs, 
                                  [state]: { ...prev.probs[state as keyof DDAConfig['probs']], [size]: parseFloat(e.target.value) } 
                                } 
                              }))}
                              className="bg-white/5 p-2 rounded-lg border border-white/5 text-white text-xs font-mono outline-none"
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-xs text-white/60">Lifesaver Logic</span>
                    <button 
                      onClick={() => setDdaConfig(prev => ({ ...prev, lifesaverEnabled: !prev.lifesaverEnabled }))}
                      className={`w-10 h-5 rounded-full transition-colors relative ${ddaConfig.lifesaverEnabled ? 'bg-blue-600' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${ddaConfig.lifesaverEnabled ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              </section>

              {/* Real-time Status */}
              <section>
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Live Status</h3>
                <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-blue-400">Remaining Space</span>
                    <span className="text-sm font-black text-blue-400">{(currentRemainingPercent * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-500" 
                      style={{ width: `${currentRemainingPercent * 100}%` }}
                    />
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        <AnimatePresence>
          {gameOver && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm rounded-lg"
            >
              <h2 className="text-4xl font-black text-white mb-2 italic">GAME OVER</h2>
              <p className="text-white/60 mb-6 font-bold tracking-widest">FINAL SCORE: {score}</p>
              <button 
                onClick={startGame}
                className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-lg transition-transform active:scale-90"
              >
                <RotateCcw size={32} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start Screen Overlay */}
        {!gameStarted && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md rounded-lg">
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={startGame}
              className="bg-blue-600 text-white px-8 py-4 rounded-full font-black text-xl flex items-center gap-3 shadow-2xl"
            >
              <Play fill="currentColor" />
              PLAY NOW
            </motion.button>
          </div>
        )}
      </div>

      {/* Tray */}
      <div className="mt-4 sm:mt-8 flex justify-center items-center gap-2 sm:gap-8 min-h-[120px] sm:min-h-[160px] w-full max-w-md px-2 sm:px-4 overflow-visible">
        {tray.map((shape) => (
          <div key={shape.id} className="flex-1 flex justify-center items-center overflow-visible">
            <DraggableBlock 
              shape={shape} 
              onDragStart={() => {
                cachedGridRect.current = gridRef.current?.getBoundingClientRect() || null;
              }}
              onDrag={(e, info) => handleDrag(shape, e, info)}
              onDragEnd={handleDragEnd}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface DraggableBlockProps {
  shape: Shape;
  onDragStart: (info: { x: number, y: number }) => void;
  onDrag: (event: any, info: { point: { x: number; y: number }; grabOffset: { x: number, y: number } }) => void;
  onDragEnd: () => void;
}

function DraggableBlock({ shape, onDragStart, onDrag, onDragEnd }: DraggableBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const grabOffset = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        ref={blockRef}
        drag
        dragMomentum={false}
        dragSnapToOrigin={true}
        onDragStart={(e, info) => {
          const rect = blockRef.current?.getBoundingClientRect();
          if (rect) {
            // Store the offset between the pointer and the block's center at the start
            // This allows us to track the visual center accurately during drag
            grabOffset.current = {
              x: info.point.x - (rect.left + rect.width / 2),
              y: info.point.y - (rect.top + rect.height / 2)
            };
          }
          onDragStart(info.point);
        }}
        onDrag={(e, info) => {
          onDrag(e, { ...info, grabOffset: grabOffset.current });
        }}
        onDragEnd={onDragEnd}
        whileDrag={{ 
          scale: 1.8,
          zIndex: 100,
          opacity: 0.8,
          filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.5))"
        }}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <div 
          className="block-preview"
          style={{ 
            gridTemplateRows: `repeat(${shape.cells.length}, 1fr)`,
            gridTemplateColumns: `repeat(${shape.cells[0].length}, 1fr)`
          }}
        >
          {shape.cells.map((row, r) => (
            row.map((cell, c) => (
              <div 
                key={`${r}-${c}`} 
                className={`block-cell ${cell === 1 ? shape.color : 'bg-transparent'}`}
              />
            ))
          ))}
        </div>
      </motion.div>
    </div>
  );
}
