import type { Difficulty } from '@/hooks/use-game-state';

interface GameControlsProps {
  onUndo: () => void;
  onHint: () => void;
  onNewPuzzle: (d?: Difficulty) => void;
  canUndo: boolean;
  difficulty: Difficulty;
}

export function GameControls({ onUndo, onHint, onNewPuzzle, canUndo, difficulty }: GameControlsProps) {
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

  return (
    <div className="flex flex-col gap-4 px-5 pb-6">
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="flex h-12 flex-1 max-w-[160px] items-center justify-center gap-2 rounded-2xl bg-secondary text-sm font-medium text-secondary-foreground transition-all hover:bg-accent disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 14-4-4 4-4" />
            <path d="M5 10h11a4 4 0 0 1 0 8h-1" />
          </svg>
          Undo
        </button>
        <button
          onClick={onHint}
          className="flex h-12 flex-1 max-w-[160px] items-center justify-center gap-2 rounded-2xl bg-secondary text-sm font-medium text-secondary-foreground transition-all hover:bg-accent"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
          </svg>
          Hint
        </button>
      </div>

      <div className="flex items-center justify-center gap-2">
        {difficulties.map(d => (
          <button
            key={d}
            onClick={() => onNewPuzzle(d)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-all ${
              d === difficulty
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-secondary-foreground'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
