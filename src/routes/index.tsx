import { createFileRoute } from '@tanstack/react-router';
import { GameBoard } from '@/components/game/GameBoard';
import { GameHeader } from '@/components/game/GameHeader';
import { GameControls } from '@/components/game/GameControls';
import { CompletionOverlay } from '@/components/game/CompletionOverlay';
import { useGameState } from '@/hooks/use-game-state';

export const Route = createFileRoute('/')({
  component: Index,
  head: () => ({
    meta: [
      { title: 'Zip Path — Puzzle Game' },
      { name: 'description', content: 'Draw a path through the maze, visiting all checkpoints in order. A beautiful mobile puzzle game.' },
    ],
  }),
});

function Index() {
  const { state, addCell, undo, reset, newPuzzle, showHint } = useGameState('easy');

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <GameHeader
        timer={state.timer}
        status={state.status}
        difficulty={state.difficulty}
        onReset={reset}
        onNewPuzzle={newPuzzle}
      />

      <div className="relative flex flex-1 flex-col">
        <GameBoard
          puzzle={state.puzzle}
          userPath={state.userPath}
          hintCell={state.hintCell}
          status={state.status}
          error={state.error}
          onCellEnter={addCell}
        />

        {state.status === 'complete' && (
          <CompletionOverlay
            timer={state.timer}
            moveCount={state.moveCount}
            onNewPuzzle={() => newPuzzle()}
          />
        )}
      </div>

      <GameControls
        onHint={showHint}
        onNewPuzzle={newPuzzle}
        difficulty={state.difficulty}
      />
    </div>
  );
}
