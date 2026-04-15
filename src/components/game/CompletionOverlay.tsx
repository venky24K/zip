import { motion } from 'framer-motion';

interface CompletionOverlayProps {
  timer: number;
  moveCount: number;
  onNewPuzzle: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CompletionOverlay({ timer, moveCount, onNewPuzzle }: CompletionOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-background/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="flex flex-col items-center gap-4 rounded-3xl bg-card p-8 game-shadow-lg"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 300 }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-game-success/15"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-game-success">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </motion.div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">Puzzle Complete!</h2>
          <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
            <span>⏱ {formatTime(timer)}</span>
            <span>🔢 {moveCount} moves</span>
          </div>
        </div>
        <button
          onClick={onNewPuzzle}
          className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
        >
          Next Puzzle
        </button>
      </motion.div>
    </motion.div>
  );
}
