export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Cell {
  row: number;
  col: number;
}

export interface PuzzleData {
  gridSize: number;
  solutionPath: Cell[];
  checkpoints: Map<number, number>; // pathIndex -> checkpointNumber
  walls: Set<string>; // "r1,c1-r2,c2" edges that are walls
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
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  return dirs
    .map(([dr, dc]) => ({ row: r + dr!, col: c + dc! }))
    .filter(n => n.row >= 0 && n.row < size && n.col >= 0 && n.col < size);
}

// Generate Hamiltonian path using Warnsdorff's heuristic + backtracking
function generateHamiltonianPath(size: number): Cell[] | null {
  const total = size * size;
  const visited = new Set<string>();

  function warnsdorffScore(r: number, c: number): number {
    return getNeighbors(r, c, size).filter(n => !visited.has(cellKey(n.row, n.col))).length;
  }

  function solve(path: Cell[]): Cell[] | null {
    if (path.length === total) return path;

    const current = path[path.length - 1]!;
    const neighbors = getNeighbors(current.row, current.col, size)
      .filter(n => !visited.has(cellKey(n.row, n.col)));

    // Sort by Warnsdorff's rule (fewest onward moves first)
    neighbors.sort((a, b) => {
      visited.add(cellKey(a.row, a.col));
      const sa = warnsdorffScore(a.row, a.col);
      visited.delete(cellKey(a.row, a.col));
      visited.add(cellKey(b.row, b.col));
      const sb = warnsdorffScore(b.row, b.col);
      visited.delete(cellKey(b.row, b.col));
      return sa - sb;
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

  // Try multiple starting positions
  const starts = [
    { row: 0, col: 0 },
    { row: 0, col: size - 1 },
    { row: size - 1, col: 0 },
    { row: Math.floor(size / 2), col: 0 },
  ];

  for (const start of starts) {
    visited.clear();
    visited.add(cellKey(start.row, start.col));
    const result = solve([start]);
    if (result) return [...result];
  }

  return null;
}

function getCheckpointCount(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy': return 3 + Math.floor(Math.random() * 2); // 3-4
    case 'medium': return 5 + Math.floor(Math.random() * 3); // 5-7
    case 'hard': return 8 + Math.floor(Math.random() * 3); // 8-10
  }
}

export function generatePuzzle(difficulty: Difficulty): PuzzleData {
  const gridSize = 6;
  const path = generateHamiltonianPath(gridSize);

  if (!path) {
    throw new Error('Failed to generate puzzle path');
  }

  // Place checkpoints along the path
  const numCheckpoints = getCheckpointCount(difficulty);
  const checkpoints = new Map<number, number>();

  // First checkpoint at start, last at end
  checkpoints.set(0, 1);
  checkpoints.set(path.length - 1, numCheckpoints);

  // Distribute remaining checkpoints evenly
  const innerCount = numCheckpoints - 2;
  if (innerCount > 0) {
    const spacing = Math.floor((path.length - 2) / (innerCount + 1));
    for (let i = 1; i <= innerCount; i++) {
      const idx = i * spacing;
      checkpoints.set(idx, i + 1);
    }
  }

  // Generate walls: all non-path-adjacent edges are walls
  const walls = new Set<string>();
  const pathEdges = new Set<string>();

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    pathEdges.add(edgeKey(a.row, a.col, b.row, b.col));
  }

  // Add some extra walls to make it maze-like (remove some non-path edges)
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      for (const n of getNeighbors(r, c, gridSize)) {
        const ek = edgeKey(r, c, n.row, n.col);
        if (!pathEdges.has(ek)) {
          // Add as wall with some probability to create maze feel
          if (Math.random() < 0.6) {
            walls.add(ek);
          }
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
    // First move must be the start of the solution
    const start = puzzle.solutionPath[0]!;
    if (nextCell.row === start.row && nextCell.col === start.col) {
      return { valid: true };
    }
    return { valid: false, reason: 'Must start at checkpoint 1' };
  }

  const last = currentPath[currentPath.length - 1]!;

  // Check adjacency
  const dr = Math.abs(nextCell.row - last.row);
  const dc = Math.abs(nextCell.col - last.col);
  if (dr + dc !== 1) {
    return { valid: false, reason: 'Must move to adjacent cell' };
  }

  // Check not already visited
  if (currentPath.some(c => c.row === nextCell.row && c.col === nextCell.col)) {
    return { valid: false, reason: 'Cell already visited' };
  }

  // Check wall
  const ek = edgeKey(last.row, last.col, nextCell.row, nextCell.col);
  if (puzzle.walls.has(ek)) {
    return { valid: false, reason: 'Wall blocks this path' };
  }

  // Check checkpoint order
  const nextPathIdx = currentPath.length;
  const checkpointAtNext = puzzle.checkpoints.get(nextPathIdx);

  // We need to verify the solution path matches
  const expectedCell = puzzle.solutionPath[nextPathIdx];
  if (!expectedCell) {
    return { valid: false, reason: 'Beyond puzzle bounds' };
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
