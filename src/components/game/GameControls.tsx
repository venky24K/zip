import type { Difficulty } from '@/lib/puzzle-generator';

interface GameControlsProps {
  onHint: () => void;
  onNewPuzzle: (d?: Difficulty) => void;
  difficulty: Difficulty;
}

export function GameControls({ onHint, onNewPuzzle, difficulty }: GameControlsProps) {
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

  return (
    <div className="flex flex-col gap-4 px-5 pb-6">
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onHint}
          className="flex h-12 w-full max-w-[200px] items-center justify-center gap-2 rounded-2xl bg-secondary text-sm font-medium text-secondary-foreground transition-all hover:bg-accent"
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
