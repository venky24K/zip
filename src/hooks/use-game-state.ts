import { useState, useCallback, useRef, useEffect } from 'react';
import {
  type Cell,
  type Difficulty,
  type PuzzleData,
  generatePuzzle,
  isOnSolutionPath,
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
}

export function useGameState(initialDifficulty: Difficulty = 'easy') {
  const [state, setState] = useState<GameState>(() => {
    const puzzle = generatePuzzle(initialDifficulty);
    return {
      puzzle,
      userPath: [],
      status: 'idle',
      difficulty: initialDifficulty,
      timer: 0,
      moveCount: 0,
      hintCell: null,
      nextCheckpoint: 1,
    };
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.status === 'playing') {
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, timer: prev.timer + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.status]);

  const addCell = useCallback((cell: Cell) => {
    setState(prev => {
      if (prev.status === 'complete') return prev;

      // Allow undoing by tapping second-to-last cell
      if (prev.userPath.length >= 2) {
        const secondLast = prev.userPath[prev.userPath.length - 2]!;
        if (secondLast.row === cell.row && secondLast.col === cell.col) {
          const newPath = prev.userPath.slice(0, -1);
          // Recalculate next checkpoint
          let nextCp = 1;
          for (const [idx, cpNum] of prev.puzzle.checkpoints.entries()) {
            if (idx < newPath.length) nextCp = cpNum + 1;
          }
          return { ...prev, userPath: newPath, nextCheckpoint: nextCp, hintCell: null };
        }
      }

      // Check if already in path
      if (prev.userPath.some(c => c.row === cell.row && c.col === cell.col)) {
        return prev;
      }

      // First cell must be checkpoint 1
      if (prev.userPath.length === 0) {
        const start = prev.puzzle.solutionPath[0]!;
        if (cell.row !== start.row || cell.col !== start.col) return prev;
      } else {
        // Must be adjacent to last cell
        const last = prev.userPath[prev.userPath.length - 1]!;
        const dr = Math.abs(cell.row - last.row);
        const dc = Math.abs(cell.col - last.col);
        if (dr + dc !== 1) return prev;
      }

      // Must be on solution path
      if (!isOnSolutionPath(prev.puzzle, prev.userPath, cell)) {
        return prev; // Block invalid moves silently
      }

      const newPath = [...prev.userPath, cell];
      const newStatus = prev.userPath.length === 0 ? 'playing' as const : prev.status;

      // Check checkpoint
      let nextCp = prev.nextCheckpoint;
      const cpNum = prev.puzzle.checkpoints.get(newPath.length - 1);
      if (cpNum !== undefined) {
        nextCp = cpNum + 1;
      }

      // Check completion
      const isComplete = newPath.length === prev.puzzle.solutionPath.length;

      return {
        ...prev,
        userPath: newPath,
        status: isComplete ? 'complete' : newStatus,
        moveCount: prev.moveCount + 1,
        nextCheckpoint: nextCp,
        hintCell: null,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState(prev => {
      if (prev.userPath.length <= 1) return { ...prev, userPath: [], status: 'idle', hintCell: null };
      const newPath = prev.userPath.slice(0, -1);
      let nextCp = 1;
      for (const [idx, cpNum] of prev.puzzle.checkpoints.entries()) {
        if (idx < newPath.length) nextCp = cpNum + 1;
      }
      return { ...prev, userPath: newPath, nextCheckpoint: nextCp, hintCell: null };
    });
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      userPath: [],
      status: 'idle',
      timer: 0,
      moveCount: 0,
      hintCell: null,
      nextCheckpoint: 1,
    }));
  }, []);

  const newPuzzle = useCallback((difficulty?: Difficulty) => {
    const diff = difficulty || state.difficulty;
    const puzzle = generatePuzzle(diff);
    setState({
      puzzle,
      userPath: [],
      status: 'idle',
      difficulty: diff,
      timer: 0,
      moveCount: 0,
      hintCell: null,
      nextCheckpoint: 1,
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
