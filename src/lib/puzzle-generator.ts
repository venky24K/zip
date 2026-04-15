export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Cell {
  row: number;
  col: number;
}

export interface PuzzleData {
  gridSize: number;
  solutionPath: Cell[];
  checkpoints: Map<number, number>; // pathIndex -> checkpointNumber
  walls: Set<string>;
  difficulty: Difficulty;
}

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function edgeKey(r1: number, c1: number, r2: number, c2: number): string {
  if (r1 < r2 || (r1 === r2 && c1 < c2)) return `${r1},${c1}-${r2},${c2}`;
  return `${r2},${c2}-${r1},${c1}`;
}

function getNeighbors(r: number, c: number, size: number): Cell[] {
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  return dirs
    .map(([dr, dc]) => ({ row: r + dr, col: c + dc }))
    .filter(n => n.row >= 0 && n.row < size && n.col >= 0 && n.col < size);
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

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// Generate Hamiltonian path using Warnsdorff's heuristic + backtracking
function generateHamiltonianPath(size: number, rng: () => number): Cell[] | null {
  const total = size * size;
  const visited = new Set<string>();

  function warnsdorffScore(r: number, c: number): number {
    return getNeighbors(r, c, size).filter(n => !visited.has(cellKey(n.row, n.col))).length;
  }

  function solve(path: Cell[], depth: number): Cell[] | null {
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

      const result = solve(path, depth + 1);
      if (result) return result;

      path.pop();
      visited.delete(key);
    }

    return null;
  }

  const starts = shuffleArray(
    [
      { row: 0, col: 0 },
      { row: 0, col: size - 1 },
      { row: size - 1, col: 0 },
      { row: size - 1, col: size - 1 },
      { row: Math.floor(size / 2), col: 0 },
      { row: 0, col: Math.floor(size / 2) },
    ],
    rng
  );

  for (const start of starts) {
    visited.clear();
    visited.add(cellKey(start.row, start.col));
    const result = solve([{ ...start }], 0);
    if (result) return [...result];
  }

  return null;
}

function getCheckpointCount(difficulty: Difficulty, rng: () => number): number {
  switch (difficulty) {
    case 'easy': return 3 + Math.floor(rng() * 2);
    case 'medium': return 5 + Math.floor(rng() * 3);
    case 'hard': return 8 + Math.floor(rng() * 3);
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

  checkpoints.set(0, 1);
  checkpoints.set(path.length - 1, numCheckpoints);

  const innerCount = numCheckpoints - 2;
  if (innerCount > 0) {
    const spacing = Math.floor((path.length - 2) / (innerCount + 1));
    for (let i = 1; i <= innerCount; i++) {
      const idx = i * spacing;
      checkpoints.set(idx, i + 1);
    }
  }

  const walls = new Set<string>();
  const pathEdges = new Set<string>();

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    pathEdges.add(edgeKey(a.row, a.col, b.row, b.col));
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      for (const n of getNeighbors(r, c, gridSize)) {
        const ek = edgeKey(r, c, n.row, n.col);
        if (!pathEdges.has(ek)) {
          walls.add(ek);
        }
      }
    }
  }

  return { gridSize, solutionPath: path, checkpoints, walls, difficulty };
}

export function validateMove(
  puzzle: PuzzleData,
  currentPath: Cell[],
  nextCell: Cell
): { valid: boolean; reason?: string } {
  if (currentPath.length === 0) {
    const start = puzzle.solutionPath[0]!;
    if (nextCell.row === start.row && nextCell.col === start.col) {
      return { valid: true };
    }
    return { valid: false, reason: 'Must start at checkpoint 1' };
  }

  const last = currentPath[currentPath.length - 1]!;
  const dr = Math.abs(nextCell.row - last.row);
  const dc = Math.abs(nextCell.col - last.col);
  if (dr + dc !== 1) {
    return { valid: false, reason: 'Must move to adjacent cell' };
  }

  if (currentPath.some(c => c.row === nextCell.row && c.col === nextCell.col)) {
    return { valid: false, reason: 'Cell already visited' };
  }

  const ek = edgeKey(last.row, last.col, nextCell.row, nextCell.col);
  if (puzzle.walls.has(ek)) {
    return { valid: false, reason: 'Wall blocks this path' };
  }

  return { valid: true };
}

export function isOnSolutionPath(puzzle: PuzzleData, path: Cell[], nextCell: Cell): boolean {
  const nextIdx = path.length;
  if (nextIdx >= puzzle.solutionPath.length) return false;
  const expected = puzzle.solutionPath[nextIdx]!;
  return expected.row === nextCell.row && expected.col === nextCell.col;
}

export function getNextHint(puzzle: PuzzleData, currentPath: Cell[]): Cell | null {
  const nextIdx = currentPath.length;
  if (nextIdx >= puzzle.solutionPath.length) return null;
  return puzzle.solutionPath[nextIdx]!;
}
