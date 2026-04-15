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
  ready: boolean;
}

export function useGameState(initialDifficulty: Difficulty = 'easy') {
  const [state, setState] = useState<GameState>(() => {
    // Generate a deterministic placeholder on server; real puzzle on client
    const puzzle = generatePuzzle(initialDifficulty, 42);
    return {
      puzzle,
      userPath: [],
      status: 'idle',
      difficulty: initialDifficulty,
      timer: 0,
      moveCount: 0,
      hintCell: null,
      nextCheckpoint: 1,
      ready: false,
    };
  });

  // On mount (client only), generate a fresh random puzzle
  useEffect(() => {
    const puzzle = generatePuzzle(state.difficulty);
    setState(prev => ({
      ...prev,
      puzzle,
      userPath: [],
      status: 'idle',
      timer: 0,
      moveCount: 0,
      hintCell: null,
      nextCheckpoint: 1,
      ready: true,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          let nextCp = 1;
          for (const [idx, cpNum] of prev.puzzle.checkpoints.entries()) {
            if (idx < newPath.length) nextCp = cpNum + 1;
          }
          return { ...prev, userPath: newPath, nextCheckpoint: nextCp, hintCell: null };
        }
      }

      if (prev.userPath.some(c => c.row === cell.row && c.col === cell.col)) {
        return prev;
      }

      if (prev.userPath.length === 0) {
        const start = prev.puzzle.solutionPath[0]!;
        if (cell.row !== start.row || cell.col !== start.col) return prev;
      } else {
        const last = prev.userPath[prev.userPath.length - 1]!;
        const dr = Math.abs(cell.row - last.row);
        const dc = Math.abs(cell.col - last.col);
        if (dr + dc !== 1) return prev;
      }

      if (!isOnSolutionPath(prev.puzzle, prev.userPath, cell)) {
        return prev;
      }

      const newPath = [...prev.userPath, cell];
      const newStatus = prev.userPath.length === 0 ? 'playing' as const : prev.status;

      let nextCp = prev.nextCheckpoint;
      const cpNum = prev.puzzle.checkpoints.get(newPath.length - 1);
      if (cpNum !== undefined) {
        nextCp = cpNum + 1;
      }

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
      ready: true,
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
