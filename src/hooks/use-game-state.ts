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

      // If cell is already in path, truncate path to that point
      const existingIndex = prev.userPath.findIndex(c => c.row === cell.row && c.col === cell.col);
      if (existingIndex !== -1) {
        // If it's already the last cell, do nothing
        if (existingIndex === prev.userPath.length - 1) return prev;

        const newPath = prev.userPath.slice(0, existingIndex + 1);
        let nc = 1;
        const visited = new Set(newPath.map(c => cellKey(c.row, c.col)));
        for (const [ck, cpNum] of prev.puzzle.checkpointCells.entries()) {
          if (visited.has(ck) && cpNum >= nc) nc = cpNum + 1;
        }
        return { ...prev, userPath: newPath, nextCheckpoint: nc, hintCell: null, error: null };
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
      if (prev.userPath.length === 0) return prev;
      const newPath = prev.userPath.slice(0, -1);
      let nc = 1;
      const visited = new Set(newPath.map(c => cellKey(c.row, c.col)));
      for (const [ck, cpNum] of prev.puzzle.checkpointCells.entries()) {
        if (visited.has(ck) && cpNum >= nc) nc = cpNum + 1;
      }
      return {
        ...prev,
        userPath: newPath,
        status: newPath.length === 0 ? 'idle' : prev.status,
        nextCheckpoint: nc,
        hintCell: null,
        error: null
      };
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
      // 1. Find the first index where userPath diverges from solutionPath
      let divergenceIdx = prev.userPath.length;
      for (let i = 0; i < prev.userPath.length; i++) {
        if (
          prev.userPath[i].row !== prev.puzzle.solutionPath[i].row ||
          prev.userPath[i].col !== prev.puzzle.solutionPath[i].col
        ) {
          divergenceIdx = i;
          break;
        }
      }

      let newPath = prev.userPath;
      let nc = prev.nextCheckpoint;

      // 2. If diverged, truncate path to the point of divergence
      if (divergenceIdx < prev.userPath.length) {
        newPath = prev.userPath.slice(0, divergenceIdx);
        
        // Recalculate nextCheckpoint for truncated path
        let nextCc = 1;
        const visited = new Set(newPath.map(c => cellKey(c.row, c.col)));
        for (const [ck, cpNum] of prev.puzzle.checkpointCells.entries()) {
          if (visited.has(ck) && cpNum >= nextCc) nextCc = cpNum + 1;
        }
        nc = nextCc;
      }

      // 3. Get the hint based on the (potentially truncated) path
      const hint = getNextHint(prev.puzzle, newPath);
      return { ...prev, userPath: newPath, nextCheckpoint: nc, hintCell: hint };
    });
  }, []);

  return { state, addCell, undo, reset, newPuzzle, showHint };
}
