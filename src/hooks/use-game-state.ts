import { useState, useCallback, useRef, useEffect } from 'react';
import {
  type Cell,
  type Difficulty,
  type PuzzleData,
  generatePuzzle,
  getNextHint,
} from '@/lib/puzzle-generator';

export type GameStatus = 'idle' | 'playing' | 'complete';

export interface GameState {
  puzzle: PuzzleData;
  userPath: Cell[];
  status: GameStatus;
  difficulty: Difficulty;
  timer: number;
  moveCount: number;
  hintCell: Cell | null;
  nextCheckpoint: number;
  ready: boolean;
  error: string | null;
}

function cellKey(r: number, c: number) {
  return `${r},${c}`;
}

export function useGameState(initialDifficulty: Difficulty = 'easy') {
  const [state, setState] = useState<GameState>(() => {
    const puzzle = generatePuzzle(initialDifficulty, 42);
    return {
      puzzle, userPath: [], status: 'idle', difficulty: initialDifficulty,
      timer: 0, moveCount: 0, hintCell: null, nextCheckpoint: 1, ready: false, error: null,
    };
  });

  // Client-side: generate fresh random puzzle
  useEffect(() => {
    const puzzle = generatePuzzle(state.difficulty);
    setState(prev => ({
      ...prev, puzzle, userPath: [], status: 'idle', timer: 0,
      moveCount: 0, hintCell: null, nextCheckpoint: 1, ready: true, error: null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state.status === 'playing') {
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, timer: prev.timer + 1 }));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.status]);

  const flashError = useCallback((msg: string) => {
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    setState(prev => ({ ...prev, error: msg }));
    errorTimeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, error: null }));
    }, 800);
  }, []);

  const addCell = useCallback((cell: Cell) => {
    setState(prev => {
      if (prev.status === 'complete') return prev;

      const key = cellKey(cell.row, cell.col);

      // Allow undo by dragging back to second-to-last cell
      if (prev.userPath.length >= 2) {
        const secondLast = prev.userPath[prev.userPath.length - 2]!;
        if (secondLast.row === cell.row && secondLast.col === cell.col) {
          const newPath = prev.userPath.slice(0, -1);
          let nextCp = 1;
          for (const [, cpNum] of prev.puzzle.checkpointCells.entries()) {
            const inPath = newPath.some(c => cellKey(c.row, c.col) === _) ;
          }
          // Recalc next checkpoint
          let nc = 1;
          const visited = new Set(newPath.map(c => cellKey(c.row, c.col)));
          for (const [ck, cpNum] of prev.puzzle.checkpointCells.entries()) {
            if (visited.has(ck) && cpNum >= nc) nc = cpNum + 1;
          }
          return { ...prev, userPath: newPath, nextCheckpoint: nc, hintCell: null, error: null };
        }
      }

      // Already visited?
      if (prev.userPath.some(c => c.row === cell.row && c.col === cell.col)) {
        return prev;
      }

      // First cell must be checkpoint 1
      if (prev.userPath.length === 0) {
        const cp = prev.puzzle.checkpointCells.get(key);
        if (cp !== 1) return prev;
      } else {
        // Must be adjacent (4-directional)
        const last = prev.userPath[prev.userPath.length - 1]!;
        const dr = Math.abs(cell.row - last.row);
        const dc = Math.abs(cell.col - last.col);
        if (dr + dc !== 1) return prev;
      }

      // Check checkpoint ordering: if this cell has a checkpoint, it must be the next expected one
      const cp = prev.puzzle.checkpointCells.get(key);
      if (cp !== undefined && cp !== prev.nextCheckpoint) {
        // Trying to reach a checkpoint out of order
        flashError(`Reach ${prev.nextCheckpoint} first!`);
        return prev;
      }

      const newPath = [...prev.userPath, cell];
      const newStatus = prev.userPath.length === 0 ? 'playing' as const : prev.status;
      const nextCp = cp !== undefined ? cp + 1 : prev.nextCheckpoint;
      const totalCells = prev.puzzle.gridSize * prev.puzzle.gridSize;
      const isComplete = newPath.length === totalCells;

      return {
        ...prev,
        userPath: newPath,
        status: isComplete ? 'complete' : newStatus,
        moveCount: prev.moveCount + 1,
        nextCheckpoint: nextCp,
        hintCell: null,
        error: null,
      };
    });
  }, [flashError]);

  const undo = useCallback(() => {
    setState(prev => {
      if (prev.userPath.length <= 1) return { ...prev, userPath: [], status: 'idle', hintCell: null, nextCheckpoint: 1, error: null };
      const newPath = prev.userPath.slice(0, -1);
      let nc = 1;
      const visited = new Set(newPath.map(c => cellKey(c.row, c.col)));
      for (const [ck, cpNum] of prev.puzzle.checkpointCells.entries()) {
        if (visited.has(ck) && cpNum >= nc) nc = cpNum + 1;
      }
      return { ...prev, userPath: newPath, nextCheckpoint: nc, hintCell: null, error: null };
    });
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev, userPath: [], status: 'idle', timer: 0, moveCount: 0,
      hintCell: null, nextCheckpoint: 1, error: null,
    }));
  }, []);

  const newPuzzle = useCallback((difficulty?: Difficulty) => {
    const diff = difficulty || state.difficulty;
    const puzzle = generatePuzzle(diff);
    setState({
      puzzle, userPath: [], status: 'idle', difficulty: diff, timer: 0,
      moveCount: 0, hintCell: null, nextCheckpoint: 1, ready: true, error: null,
    });
  }, [state.difficulty]);

  const showHint = useCallback(() => {
    setState(prev => {
      const hint = getNextHint(prev.puzzle, prev.userPath);
      return { ...prev, hintCell: hint };
    });
  }, []);

  return { state, addCell, undo, reset, newPuzzle, showHint };
}
