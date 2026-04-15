import { useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Cell, PuzzleData } from '@/lib/puzzle-generator';
import type { GameStatus } from '@/hooks/use-game-state';

interface GameBoardProps {
  puzzle: PuzzleData;
  userPath: Cell[];
  hintCell: Cell | null;
  status: GameStatus;
  onCellEnter: (cell: Cell) => void;
}

const CELL_SIZE = 52;
const GAP = 4;
const PATH_RADIUS = 20;
const CHECKPOINT_RADIUS = 14;

export function GameBoard({ puzzle, userPath, hintCell, status, onCellEnter }: GameBoardProps) {
  const boardRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);

  const totalSize = puzzle.gridSize * CELL_SIZE + (puzzle.gridSize - 1) * GAP;
  const padding = 16;
  const svgSize = totalSize + padding * 2;

  const getCellCenter = useCallback((r: number, c: number) => ({
    x: padding + c * (CELL_SIZE + GAP) + CELL_SIZE / 2,
    y: padding + r * (CELL_SIZE + GAP) + CELL_SIZE / 2,
  }), []);

  const getCellFromPoint = useCallback((clientX: number, clientY: number): Cell | null => {
    const svg = boardRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scale = svgSize / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;

    for (let r = 0; r < puzzle.gridSize; r++) {
      for (let c = 0; c < puzzle.gridSize; c++) {
        const center = getCellCenter(r, c);
        const dx = x - center.x;
        const dy = y - center.y;
        if (dx * dx + dy * dy < (CELL_SIZE / 2) * (CELL_SIZE / 2)) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }, [puzzle.gridSize, svgSize, getCellCenter]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (cell) onCellEnter(cell);
  }, [getCellFromPoint, onCellEnter]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (cell) onCellEnter(cell);
  }, [getCellFromPoint, onCellEnter]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Build user path SVG line
  const userPathD = useMemo(() => {
    if (userPath.length === 0) return '';
    return userPath
      .map((cell, i) => {
        const { x, y } = getCellCenter(cell.row, cell.col);
        return i === 0 ? `M${x},${y}` : `L${x},${y}`;
      })
      .join(' ');
  }, [userPath, getCellCenter]);

  // Visited set for styling
  const visitedSet = useMemo(() => {
    const set = new Set<string>();
    userPath.forEach(c => set.add(`${c.row},${c.col}`));
    return set;
  }, [userPath]);

  // Solution path edges for maze corridors
  const corridorEdges = useMemo(() => {
    const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 0; i < puzzle.solutionPath.length - 1; i++) {
      const a = puzzle.solutionPath[i]!;
      const b = puzzle.solutionPath[i + 1]!;
      const ca = getCellCenter(a.row, a.col);
      const cb = getCellCenter(b.row, b.col);
      edges.push({ x1: ca.x, y1: ca.y, x2: cb.x, y2: cb.y });
    }
    return edges;
  }, [puzzle.solutionPath, getCellCenter]);

  // Non-path connections (open corridors not on solution)
  const openEdges = useMemo(() => {
    const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const solEdges = new Set<string>();
    for (let i = 0; i < puzzle.solutionPath.length - 1; i++) {
      const a = puzzle.solutionPath[i]!;
      const b = puzzle.solutionPath[i + 1]!;
      const k1 = `${a.row},${a.col}-${b.row},${b.col}`;
      const k2 = `${b.row},${b.col}-${a.row},${a.col}`;
      solEdges.add(k1);
      solEdges.add(k2);
    }

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let r = 0; r < puzzle.gridSize; r++) {
      for (let c = 0; c < puzzle.gridSize; c++) {
        for (const [dr, dc] of dirs) {
          const nr = r + dr!;
          const nc = c + dc!;
          if (nr < 0 || nr >= puzzle.gridSize || nc < 0 || nc >= puzzle.gridSize) continue;
          const k = `${r},${c}-${nr},${nc}`;
          if (solEdges.has(k)) continue;
          // Check if this edge is a wall
          const ek1 = r < nr || (r === nr && c < nc)
            ? `${r},${c}-${nr},${nc}`
            : `${nr},${nc}-${r},${c}`;
          if (puzzle.walls.has(ek1)) continue;
          // It's open but not on solution path - don't show (makes it cleaner)
        }
      }
    }
    return edges;
  }, [puzzle]);

  const gradientId = 'pathGradient';
  const hintKey = hintCell ? `${hintCell.row},${hintCell.col}` : null;

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="relative w-full max-w-[400px]">
        <svg
          ref={boardRef}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--game-path)" />
              <stop offset="100%" stopColor="var(--game-path-end)" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background */}
          <rect x="0" y="0" width={svgSize} height={svgSize} rx="24" fill="var(--card)" />

          {/* Corridor connections (solution path edges as subtle tracks) */}
          {corridorEdges.map((e, i) => (
            <line
              key={`corridor-${i}`}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke="var(--game-tile)"
              strokeWidth={PATH_RADIUS * 2}
              strokeLinecap="round"
            />
          ))}

          {/* Cell circles (walkable tiles) */}
          {puzzle.solutionPath.map((cell, i) => {
            const { x, y } = getCellCenter(cell.row, cell.col);
            const isVisited = visitedSet.has(`${cell.row},${cell.col}`);
            const isHint = hintKey === `${cell.row},${cell.col}`;

            return (
              <circle
                key={`cell-${cell.row}-${cell.col}`}
                cx={x}
                cy={y}
                r={PATH_RADIUS}
                fill={isVisited ? 'var(--game-tile-active)' : 'var(--game-tile)'}
                stroke={isHint ? 'var(--game-path)' : 'none'}
                strokeWidth={isHint ? 2.5 : 0}
                strokeDasharray={isHint ? '4 4' : undefined}
                opacity={isHint ? 1 : 0.8}
              />
            );
          })}

          {/* User path */}
          {userPath.length > 0 && (
            <path
              d={userPathD}
              fill="none"
              stroke={status === 'complete' ? 'var(--game-success)' : `url(#${gradientId})`}
              strokeWidth={PATH_RADIUS * 1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={status === 'complete' ? 'url(#glow)' : undefined}
            />
          )}

          {/* User path dots */}
          {userPath.map((cell, i) => {
            const { x, y } = getCellCenter(cell.row, cell.col);
            const t = userPath.length > 1 ? i / (userPath.length - 1) : 0;
            return (
              <circle
                key={`dot-${i}`}
                cx={x}
                cy={y}
                r={6}
                fill={status === 'complete' ? 'var(--game-success)' : `color-mix(in oklch, var(--game-path) ${Math.round((1 - t) * 100)}%, var(--game-path-end))`}
                opacity={0.9}
              />
            );
          })}

          {/* Checkpoints */}
          {Array.from(puzzle.checkpoints.entries()).map(([pathIdx, cpNum]) => {
            const cell = puzzle.solutionPath[pathIdx]!;
            const { x, y } = getCellCenter(cell.row, cell.col);
            const isReached = pathIdx < userPath.length;

            return (
              <g key={`cp-${cpNum}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={CHECKPOINT_RADIUS}
                  fill={isReached ? (status === 'complete' ? 'var(--game-success)' : 'var(--game-checkpoint)') : 'var(--card)'}
                  stroke={isReached ? 'none' : 'var(--game-checkpoint)'}
                  strokeWidth={2}
                />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="11"
                  fontWeight="700"
                  fill={isReached ? 'var(--card)' : 'var(--game-checkpoint)'}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {cpNum}
                </text>
              </g>
            );
          })}

          {/* Hint pulse animation */}
          {hintCell && (
            <motion.circle
              cx={getCellCenter(hintCell.row, hintCell.col).x}
              cy={getCellCenter(hintCell.row, hintCell.col).y}
              r={PATH_RADIUS}
              fill="none"
              stroke="var(--game-path)"
              strokeWidth={2}
              initial={{ r: PATH_RADIUS * 0.5, opacity: 1 }}
              animate={{ r: PATH_RADIUS * 1.5, opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
        </svg>

        {/* Progress indicator */}
        <div className="mt-3 flex items-center justify-center">
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--game-path), var(--game-path-end))' }}
              initial={{ width: '0%' }}
              animate={{ width: `${(userPath.length / puzzle.solutionPath.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
