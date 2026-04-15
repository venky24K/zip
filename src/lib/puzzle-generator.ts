export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Cell {
  row: number;
  col: number;
}

export interface PuzzleData {
  gridSize: number;
  solutionPath: Cell[];
  checkpoints: Map<number, number>; // pathIndex -> checkpointNumber
  checkpointCells: Map<string, number>; // "r,c" -> checkpointNumber
  difficulty: Difficulty;
}

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

// Seeded PRNG (mulberry32)
function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getNeighbors(r: number, c: number, size: number): Cell[] {
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  return dirs
    .map(([dr, dc]) => ({ row: r + dr, col: c + dc }))
    .filter(n => n.row >= 0 && n.row < size && n.col >= 0 && n.col < size);
}

// Generate Hamiltonian path using Warnsdorff's heuristic + backtracking
function generateHamiltonianPath(size: number, rng: () => number): Cell[] | null {
  const total = size * size;
  const visited = new Set<string>();

  function warnsdorffScore(r: number, c: number): number {
    return getNeighbors(r, c, size).filter(n => !visited.has(cellKey(n.row, n.col))).length;
  }

  function solve(path: Cell[]): Cell[] | null {
    if (path.length === total) return path;

    const current = path[path.length - 1]!;
    let neighbors = getNeighbors(current.row, current.col, size)
      .filter(n => !visited.has(cellKey(n.row, n.col)));

    // Sort by Warnsdorff's rule with random tie-breaking
    neighbors = neighbors.map(n => {
      visited.add(cellKey(n.row, n.col));
      const score = warnsdorffScore(n.row, n.col);
      visited.delete(cellKey(n.row, n.col));
      return { ...n, score };
    }).sort((a, b) => {
      const diff = (a as any).score - (b as any).score;
      return diff !== 0 ? diff : rng() - 0.5;
    });

    for (const next of neighbors) {
      const key = cellKey(next.row, next.col);
      visited.add(key);
      path.push(next);

      const result = solve(path);
      if (result) return result;

      path.pop();
      visited.delete(key);
    }

    return null;
  }

  // Try random starting corners
  const corners = [
    { row: 0, col: 0 },
    { row: 0, col: size - 1 },
    { row: size - 1, col: 0 },
    { row: size - 1, col: size - 1 },
    { row: Math.floor(size / 2), col: 0 },
    { row: 0, col: Math.floor(size / 2) },
  ];
  // Shuffle starts
  for (let i = corners.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [corners[i], corners[j]] = [corners[j]!, corners[i]!];
  }

  for (const start of corners) {
    visited.clear();
    visited.add(cellKey(start.row, start.col));
    const result = solve([{ ...start }]);
    if (result) return [...result];
  }

  return null;
}

function getCheckpointCount(difficulty: Difficulty, rng: () => number): number {
  switch (difficulty) {
    case 'easy': return 3 + Math.floor(rng() * 2); // 3-4
    case 'medium': return 5 + Math.floor(rng() * 3); // 5-7
    case 'hard': return 8 + Math.floor(rng() * 3); // 8-10
  }
}

export function generatePuzzle(difficulty: Difficulty, seed?: number): PuzzleData {
  const rng = createRng(seed ?? (Date.now() ^ (Math.random() * 0xffffffff)));
  const gridSize = 6;
  const path = generateHamiltonianPath(gridSize, rng);

  if (!path) {
    throw new Error('Failed to generate puzzle path');
  }

  const numCheckpoints = getCheckpointCount(difficulty, rng);
  const checkpoints = new Map<number, number>();

  // First at start, last at end
  checkpoints.set(0, 1);
  checkpoints.set(path.length - 1, numCheckpoints);

  // Distribute remaining evenly
  const innerCount = numCheckpoints - 2;
  if (innerCount > 0) {
    const spacing = Math.floor((path.length - 2) / (innerCount + 1));
    for (let i = 1; i <= innerCount; i++) {
      checkpoints.set(i * spacing, i + 1);
    }
  }

  // Build cell->checkpoint lookup
  const checkpointCells = new Map<string, number>();
  for (const [pathIdx, cpNum] of checkpoints.entries()) {
    const cell = path[pathIdx]!;
    checkpointCells.set(cellKey(cell.row, cell.col), cpNum);
  }

  return { gridSize, solutionPath: path, checkpoints, checkpointCells, difficulty };
}

export function getNextHint(puzzle: PuzzleData, currentPath: Cell[]): Cell | null {
  // 1. Find the first point where the user path diverges from the solution
  for (let i = 0; i < currentPath.length; i++) {
    const u = currentPath[i];
    const s = puzzle.solutionPath[i];
    if (u.row !== s.row || u.col !== s.col) {
      // Divergence! Hint is where they should have gone.
      return s;
    }
  }

  // 2. No divergence, give the next step after current path
  const nextIdx = currentPath.length;
  if (nextIdx >= puzzle.solutionPath.length) return null;
  return puzzle.solutionPath[nextIdx]!;
}
