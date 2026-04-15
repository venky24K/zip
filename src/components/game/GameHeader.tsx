import type { Difficulty } from '@/lib/puzzle-generator';
import type { GameStatus } from '@/hooks/use-game-state';

interface GameHeaderProps {
  timer: number;
  status: GameStatus;
  difficulty: Difficulty;
  onReset: () => void;
  onNewPuzzle: (d?: Difficulty) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function GameHeader({ timer, status, difficulty, onReset, onNewPuzzle }: GameHeaderProps) {
  return (
    <header className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Zip Path</h1>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize text-secondary-foreground">
          {difficulty}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {formatTime(timer)}
        </span>
        <button
          onClick={onReset}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-accent"
          aria-label="Reset puzzle"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>
    </header>
  );
}
