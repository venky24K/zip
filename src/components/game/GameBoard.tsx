import { useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Cell, PuzzleData } from '@/lib/puzzle-generator';
import type { GameStatus } from '@/hooks/use-game-state';

interface GameBoardProps {
  puzzle: PuzzleData;
  userPath: Cell[];
  hintCell: Cell | null;
  status: GameStatus;
  error: string | null;
  onCellEnter: (cell: Cell) => void;
}

const CELL_SIZE = 48;
const GAP = 5;
const CORNER_R = 12;

export function GameBoard({ puzzle, userPath, hintCell, status, error, onCellEnter }: GameBoardProps) {
  const boardRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);

  const totalSize = puzzle.gridSize * CELL_SIZE + (puzzle.gridSize + 1) * GAP;
  const padding = 8;
  const svgSize = totalSize + padding * 2;

  const getCellTopLeft = useCallback((r: number, c: number) => ({
    x: padding + GAP + c * (CELL_SIZE + GAP),
    y: padding + GAP + r * (CELL_SIZE + GAP),
  }), []);

  const getCellCenter = useCallback((r: number, c: number) => {
    const tl = getCellTopLeft(r, c);
    return { x: tl.x + CELL_SIZE / 2, y: tl.y + CELL_SIZE / 2 };
  }, [getCellTopLeft]);

  const getCellFromPoint = useCallback((clientX: number, clientY: number): Cell | null => {
    const svg = boardRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scale = svgSize / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;

    for (let r = 0; r < puzzle.gridSize; r++) {
      for (let c = 0; c < puzzle.gridSize; c++) {
        const tl = getCellTopLeft(r, c);
        if (x >= tl.x && x <= tl.x + CELL_SIZE && y >= tl.y && y <= tl.y + CELL_SIZE) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }, [puzzle.gridSize, svgSize, getCellTopLeft]);

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

  // Visited set
  const visitedSet = useMemo(() => {
    const set = new Set<string>();
    userPath.forEach(c => set.add(`${c.row},${c.col}`));
    return set;
  }, [userPath]);

  // User path SVG
  const userPathD = useMemo(() => {
    if (userPath.length === 0) return '';
    return userPath
      .map((cell, i) => {
        const { x, y } = getCellCenter(cell.row, cell.col);
        return i === 0 ? `M${x},${y}` : `L${x},${y}`;
      })
      .join(' ');
  }, [userPath, getCellCenter]);

  const hintKey = hintCell ? `${hintCell.row},${hintCell.col}` : null;
  const gradientId = 'pathGradient';

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="relative w-full max-w-[400px]">
        {/* Error toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute -top-10 left-1/2 z-20 -translate-x-1/2 rounded-full bg-destructive px-4 py-1.5 text-xs font-medium text-destructive-foreground whitespace-nowrap"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

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
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Board background */}
          <rect x={padding} y={padding} width={totalSize} height={totalSize} rx="20" fill="var(--game-wall)" />

          {/* All grid cells */}
          {Array.from({ length: puzzle.gridSize }, (_, r) =>
            Array.from({ length: puzzle.gridSize }, (_, c) => {
              const tl = getCellTopLeft(r, c);
              const key = `${r},${c}`;
              const isVisited = visitedSet.has(key);
              const isHint = hintKey === key;
              const cpNum = puzzle.checkpointCells.get(key);

              return (
                <g key={key}>
                  <rect
                    x={tl.x}
                    y={tl.y}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    rx={CORNER_R}
                    fill={isVisited ? 'var(--game-tile-active)' : 'var(--game-tile)'}
                    stroke={isHint ? 'var(--game-path)' : 'none'}
                    strokeWidth={isHint ? 2.5 : 0}
                    strokeDasharray={isHint ? '4 3' : undefined}
                  />

                  {/* Checkpoint marker */}
                  {cpNum !== undefined && (
                    <>
                      <circle
                        cx={tl.x + CELL_SIZE / 2}
                        cy={tl.y + CELL_SIZE / 2}
                        r={16}
                        fill={isVisited ? (status === 'complete' ? 'var(--game-success)' : 'var(--game-checkpoint)') : 'var(--card)'}
                        stroke={isVisited ? 'none' : 'var(--game-checkpoint)'}
                        strokeWidth={2.5}
                      />
                      <text
                        x={tl.x + CELL_SIZE / 2}
                        y={tl.y + CELL_SIZE / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="12"
                        fontWeight="700"
                        fill={isVisited ? 'var(--card)' : 'var(--game-checkpoint)'}
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        {cpNum}
                      </text>
                    </>
                  )}
                </g>
              );
            })
          )}

          {/* User drawn path */}
          {userPath.length > 0 && (
            <path
              d={userPathD}
              fill="none"
              stroke={status === 'complete' ? 'var(--game-success)' : `url(#${gradientId})`}
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={status === 'complete' ? 'url(#glow)' : undefined}
              opacity={0.85}
            />
          )}

          {/* Current position dot */}
          {userPath.length > 0 && (() => {
            const last = userPath[userPath.length - 1]!;
            const { x, y } = getCellCenter(last.row, last.col);
            return (
              <circle
                cx={x}
                cy={y}
                r={6}
                fill={status === 'complete' ? 'var(--game-success)' : 'var(--game-path-end)'}
              />
            );
          })()}

          {/* Hint pulse */}
          {hintCell && (
            <motion.rect
              x={getCellTopLeft(hintCell.row, hintCell.col).x}
              y={getCellTopLeft(hintCell.row, hintCell.col).y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={CORNER_R}
              fill="none"
              stroke="var(--game-path)"
              strokeWidth={2}
              initial={{ opacity: 1 }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
        </svg>

      </div>
    </div>
  );
}
