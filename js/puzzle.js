/**
 * Khun Phaen / Klotski rules.
 *
 * Board is 4 columns by 5 rows. Row 0 is the far end of the tray.
 * Row 4 is the near edge, where the wooden rail has a two-cell exit
 * over columns 1 and 2. The hero is the 2×2 block. It escapes when it
 * sits on that exit (top-left cell at column 1, row 3), covering the
 * near-middle of the tray so it can slide out through the gap.
 *
 * A move is one straight slide of a single block, any number of cells,
 * stopping on an empty cell. Blocks never overlap, turn a corner, or
 * leave the tray in the same gesture.
 *
 * Starting layout from the close crop of the wooden puzzle.
 * The near edge, with the exit, is the bottom row:
 *
 *   H H V .
 *   H H V o
 *   . V V V
 *   o V V V
 *   = = o o
 *
 * H is the 2×2 hero (white dot), V a tall 1×2 (red dot),
 * = the wide 1×2 (red dot), o a small square (blue dot), . empty.
 */

export const COLS = 4;
export const ROWS = 5;

/** Top-left cell of the hero when it is sitting in the exit. */
export const EXIT_COL = 1;
export const EXIT_ROW = 3;

/**
 * @returns {Piece[]}
 */
export function createInitialPieces() {
  return [
    { id: "hero", role: "hero", w: 2, h: 2, col: 0, row: 0, dot: "white" },
    { id: "v-a", role: "vert", w: 1, h: 2, col: 2, row: 0, dot: "red" },
    { id: "s-blue-top", role: "small", w: 1, h: 1, col: 3, row: 1, dot: "blue" },
    { id: "v-b", role: "vert", w: 1, h: 2, col: 1, row: 2, dot: "red" },
    { id: "v-c", role: "vert", w: 1, h: 2, col: 2, row: 2, dot: "red" },
    { id: "v-d", role: "vert", w: 1, h: 2, col: 3, row: 2, dot: "red" },
    { id: "s-blue-left", role: "small", w: 1, h: 1, col: 0, row: 3, dot: "blue" },
    { id: "h-front", role: "horiz", w: 2, h: 1, col: 0, row: 4, dot: "red" },
    { id: "s-blue-mid", role: "small", w: 1, h: 1, col: 2, row: 4, dot: "blue" },
    { id: "s-blue-right", role: "small", w: 1, h: 1, col: 3, row: 4, dot: "blue" },
  ];
}

/**
 * @param {Piece[]} [pieces]
 */
export function createGame(pieces = createInitialPieces()) {
  return {
    pieces: pieces.map((piece) => ({ ...piece })),
    moves: 0,
    history: [],
    won: false,
  };
}

/**
 * @param {Piece[]} pieces
 */
export function findPiece(pieces, id) {
  return pieces.find((piece) => piece.id === id) ?? null;
}

/**
 * @param {Piece[]} pieces
 */
export function heroPiece(pieces) {
  return pieces.find((piece) => piece.role === "hero") ?? null;
}

/**
 * The hero has reached the exit when it covers the two near-middle
 * columns, flush with the gap in the rail.
 * @param {Piece[]} pieces
 */
export function isWin(pieces) {
  const hero = heroPiece(pieces);
  return !!hero && hero.col === EXIT_COL && hero.row === EXIT_ROW;
}

/**
 * @param {Piece[]} pieces
 * @param {string} [ignoreId]
 * @returns {boolean[][]}
 */
export function occupancy(pieces, ignoreId) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  for (const piece of pieces) {
    if (piece.id === ignoreId) continue;
    for (let row = 0; row < piece.h; row += 1) {
      for (let col = 0; col < piece.w; col += 1) {
        grid[piece.row + row][piece.col + col] = true;
      }
    }
  }
  return grid;
}

/**
 * @param {boolean[][]} grid
 * @param {number} w
 * @param {number} h
 * @param {number} col
 * @param {number} row
 */
export function fits(grid, w, h, col, row) {
  if (col < 0 || row < 0 || col + w > COLS || row + h > ROWS) return false;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (grid[row + y][col + x]) return false;
    }
  }
  return true;
}

const DIRECTIONS = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
];

/**
 * Every cell a block can reach in one straight slide.
 * The current cell is not included.
 * @param {Piece[]} pieces
 * @param {string} id
 * @returns {{ col: number, row: number, steps: number }[]}
 */
export function legalSlides(pieces, id) {
  const piece = findPiece(pieces, id);
  if (!piece) return [];
  const grid = occupancy(pieces, id);
  const slides = [];
  for (const { dc, dr } of DIRECTIONS) {
    let steps = 1;
    while (
      fits(grid, piece.w, piece.h, piece.col + dc * steps, piece.row + dr * steps)
    ) {
      slides.push({
        col: piece.col + dc * steps,
        row: piece.row + dr * steps,
        steps,
      });
      steps += 1;
    }
  }
  return slides;
}

/**
 * @param {Piece[]} pieces
 * @param {string} id
 * @param {number} col
 * @param {number} row
 */
export function isLegalSlide(pieces, id, col, row) {
  return legalSlides(pieces, id).some((slide) => slide.col === col && slide.row === row);
}

/**
 * Returns a new piece list. Does not check legality.
 * @param {Piece[]} pieces
 * @param {string} id
 * @param {number} col
 * @param {number} row
 */
export function applySlide(pieces, id, col, row) {
  return pieces.map((piece) => (piece.id === id ? { ...piece, col, row } : piece));
}

/**
 * One gesture. A slide that changes a block's cell counts as one move,
 * however many cells it travels. Illegal drops and non-moves leave the
 * state unchanged.
 * @param {GameState} state
 * @param {string} id
 * @param {number} col
 * @param {number} row
 */
export function performMove(state, id, col, row) {
  if (state.won || !isLegalSlide(state.pieces, id, col, row)) {
    return { state, moved: false };
  }
  const pieces = applySlide(state.pieces, id, col, row);
  const next = {
    pieces,
    moves: state.moves + 1,
    history: state.history.concat([
      { pieces: state.pieces, moves: state.moves },
    ]),
    won: isWin(pieces),
  };
  return { state: next, moved: true };
}

/**
 * @param {GameState} state
 */
export function undoMove(state) {
  if (state.history.length === 0) return state;
  const previous = state.history[state.history.length - 1];
  return {
    pieces: previous.pieces,
    moves: previous.moves,
    history: state.history.slice(0, -1),
    won: false,
  };
}

/**
 * Shape-only key. Blocks of the same shape are interchangeable, which
 * keeps the search on the geometry of the tray rather than paint colors.
 * @param {Piece[]} pieces
 */
export function stateKey(pieces) {
  const buckets = { hero: [], vert: [], horiz: [], small: [] };
  for (const piece of pieces) {
    buckets[piece.role].push(`${piece.col}${piece.row}`);
  }
  return ["hero", "vert", "horiz", "small"]
    .map((role) => buckets[role].sort().join("."))
    .join("|");
}

/**
 * Breadth-first search. Each edge is one straight slide of any length,
 * so the first time the exit is reached the path is a shortest solution.
 * @param {Piece[]} pieces
 * @returns {{ moveCount: number, moves: { id: string, col: number, row: number }[] } | null}
 */
export function solve(pieces) {
  const start = pieces.map((piece) => ({ ...piece }));
  const startKey = stateKey(start);
  if (isWin(start)) return { moveCount: 0, moves: [] };

  /** @type {Piece[][]} */
  const queue = [start];
  /** @type {Map<string, { prev: string | null, move: { id: string, col: number, row: number } | null }>} */
  const parent = new Map([[startKey, { prev: null, move: null }]]);
  let head = 0;
  let found = null;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    const currentKey = stateKey(current);
    for (const piece of current) {
      const slides = legalSlides(current, piece.id);
      for (const slide of slides) {
        const next = applySlide(current, piece.id, slide.col, slide.row);
        const key = stateKey(next);
        if (parent.has(key)) continue;
        parent.set(key, {
          prev: currentKey,
          move: { id: piece.id, col: slide.col, row: slide.row },
        });
        if (isWin(next)) {
          found = key;
          break;
        }
        queue.push(next);
      }
      if (found) break;
    }
    if (found) break;
  }

  if (!found) return null;

  /** @type {{ id: string, col: number, row: number }[]} */
  const moves = [];
  let key = found;
  while (true) {
    const node = parent.get(key);
    if (!node || !node.prev || !node.move) break;
    moves.push(node.move);
    key = node.prev;
  }
  moves.reverse();
  return { moveCount: moves.length, moves };
}

/**
 * @param {Piece[]} pieces
 * @param {{ id: string, col: number, row: number }[]} moves
 */
export function replay(pieces, moves) {
  let current = pieces;
  for (const move of moves) {
    current = applySlide(current, move.id, move.col, move.row);
  }
  return current;
}

/**
 * @param {Piece[]} pieces
 */
export function renderGrid(pieces) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill("."));
  const mark = { hero: "H", vert: "V", horiz: "=", small: "o" };
  for (const piece of pieces) {
    const symbol = mark[piece.role] ?? "?";
    for (let row = 0; row < piece.h; row += 1) {
      for (let col = 0; col < piece.w; col += 1) {
        grid[piece.row + row][piece.col + col] = symbol;
      }
    }
  }
  return grid.map((row) => row.join(" ")).join("\n");
}

/**
 * @param {Piece[]} pieces
 */
export function coveredCells(pieces) {
  /** @type {Map<string, string>} */
  const cells = new Map();
  for (const piece of pieces) {
    for (let row = 0; row < piece.h; row += 1) {
      for (let col = 0; col < piece.w; col += 1) {
        const x = piece.col + col;
        const y = piece.row + row;
        const key = `${x},${y}`;
        cells.set(key, cells.has(key) ? "overlap" : piece.id);
      }
    }
  }
  return cells;
}
