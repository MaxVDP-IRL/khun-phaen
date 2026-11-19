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
    hints: 0,
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
    hints: state.hints ?? 0,
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
    hints: state.hints ?? 0,
  };
}

/**
 * A shown hint. Undo does not call this in reverse.
 * @param {GameState} state
 */
export function addHint(state) {
  return { ...state, hints: (state.hints ?? 0) + 1 };
}

/**
 * Clean best is only games played with no hints. A hinted win updates
 * the separate hinted best and leaves the clean best alone.
 * @param {number} moves
 * @param {number} hintsUsed
 * @param {{ clean: number | null, hinted: number | null }} bests
 */
export function recordWin(moves, hintsUsed, bests) {
  const clean = bests.clean ?? null;
  const hinted = bests.hinted ?? null;
  if (hintsUsed > 0) {
    const improved = hinted == null || moves < hinted;
    return {
      clean,
      hinted: improved ? moves : hinted,
      improvedClean: false,
      improvedHinted: improved,
    };
  }
  const improved = clean == null || moves < clean;
  return {
    clean: improved ? moves : clean,
    hinted,
    improvedClean: improved,
    improvedHinted: false,
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

const PIECE_W = [2, 1, 1, 1, 1, 2, 1, 1, 1, 1];
const PIECE_H = [2, 2, 2, 2, 2, 1, 1, 1, 1, 1];
const PIECE_AT = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18];
const SLIDE_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** @type {Map<string, number> | null} */
let distanceMap = null;
/** @type {{ states: number, buildMs: number } | null} */
let distanceStats = null;

/**
 * @param {Uint8Array} buf
 * @param {number} start
 * @param {number} count
 */
function sortPairs(buf, start, count) {
  for (let i = 1; i < count; i += 1) {
    const col = buf[start + i * 2];
    const row = buf[start + i * 2 + 1];
    const rank = col * 5 + row;
    let j = i - 1;
    while (j >= 0 && buf[start + j * 2] * 5 + buf[start + j * 2 + 1] > rank) {
      buf[start + (j + 1) * 2] = buf[start + j * 2];
      buf[start + (j + 1) * 2 + 1] = buf[start + j * 2 + 1];
      j -= 1;
    }
    buf[start + (j + 1) * 2] = col;
    buf[start + (j + 1) * 2 + 1] = row;
  }
}

/**
 * @param {Uint8Array} buf
 */
function canonState(buf) {
  sortPairs(buf, 2, 4);
  sortPairs(buf, 12, 4);
}

/**
 * @param {Uint8Array} buf
 */
function keyState(buf) {
  let key = "";
  for (let i = 0; i < 20; i += 1) key += buf[i];
  return key;
}

/**
 * @param {Piece[]} pieces
 */
function packPieces(pieces) {
  const buf = new Uint8Array(20);
  const hero = pieces.find((piece) => piece.role === "hero");
  const horiz = pieces.find((piece) => piece.role === "horiz");
  const verts = pieces.filter((piece) => piece.role === "vert");
  const smalls = pieces.filter((piece) => piece.role === "small");
  if (!hero || !horiz || verts.length !== 4 || smalls.length !== 4) return null;
  buf[0] = hero.col;
  buf[1] = hero.row;
  verts.forEach((piece, index) => {
    buf[2 + index * 2] = piece.col;
    buf[3 + index * 2] = piece.row;
  });
  buf[10] = horiz.col;
  buf[11] = horiz.row;
  smalls.forEach((piece, index) => {
    buf[12 + index * 2] = piece.col;
    buf[13 + index * 2] = piece.row;
  });
  canonState(buf);
  return buf;
}

/**
 * @param {Uint8Array} buf
 * @param {Uint8Array} grid
 */
function fillGrid(buf, grid) {
  grid.fill(0);
  for (let piece = 0; piece < 10; piece += 1) stampPiece(buf, grid, piece, 1);
}

/**
 * @param {Uint8Array} buf
 * @param {Uint8Array} grid
 * @param {number} piece
 * @param {number} value
 */
function stampPiece(buf, grid, piece, value) {
  const at = PIECE_AT[piece];
  const col = buf[at];
  const row = buf[at + 1];
  const w = PIECE_W[piece];
  const h = PIECE_H[piece];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) grid[(row + y) * 4 + (col + x)] = value;
  }
}

/**
 * @param {Uint8Array} grid
 * @param {number} w
 * @param {number} h
 * @param {number} col
 * @param {number} row
 */
function cellFree(grid, w, h, col, row) {
  if (col < 0 || row < 0 || col + w > COLS || row + h > ROWS) return false;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (grid[(row + y) * 4 + (col + x)]) return false;
    }
  }
  return true;
}

const scratchState = new Uint8Array(20);

/**
 * @param {Uint8Array} buf
 * @param {Uint8Array} grid
 * @param {(key: string) => void} visit
 */
function eachNeighbor(buf, grid, visit) {
  fillGrid(buf, grid);
  for (let piece = 0; piece < 10; piece += 1) {
    stampPiece(buf, grid, piece, 0);
    const at = PIECE_AT[piece];
    const col = buf[at];
    const row = buf[at + 1];
    const w = PIECE_W[piece];
    const h = PIECE_H[piece];
    for (let dir = 0; dir < 4; dir += 1) {
      const dc = SLIDE_DIRS[dir][0];
      const dr = SLIDE_DIRS[dir][1];
      let steps = 1;
      while (cellFree(grid, w, h, col + dc * steps, row + dr * steps)) {
        scratchState.set(buf);
        scratchState[at] = col + dc * steps;
        scratchState[at + 1] = row + dr * steps;
        canonState(scratchState);
        visit(keyState(scratchState));
        steps += 1;
      }
    }
    stampPiece(buf, grid, piece, 1);
  }
}

/**
 * Distances from every position reachable in this puzzle to the nearest win.
 * Built once and reused for every hint.
 */
export function warmDistanceMap() {
  if (distanceMap) return distanceStats;
  const started = performance.now();
  const start = packPieces(createInitialPieces());
  if (!start) return null;
  const grid = new Uint8Array(20);
  /** @type {Uint8Array[]} */
  const states = [start];
  const indexOf = new Map([[keyState(start), 0]]);
  /** @type {number[][]} */
  const neighbors = [[]];
  /** @type {number[]} */
  const goals = [];
  if (start[0] === EXIT_COL && start[1] === EXIT_ROW) goals.push(0);
  const queue = [0];
  let head = 0;
  while (head < queue.length) {
    const index = queue[head];
    head += 1;
    const current = states[index];
    eachNeighbor(current, grid, (key) => {
      let neighbor = indexOf.get(key);
      if (neighbor == null) {
        neighbor = states.length;
        states.push(scratchState.slice());
        indexOf.set(key, neighbor);
        neighbors.push([]);
        queue.push(neighbor);
        if (scratchState[0] === EXIT_COL && scratchState[1] === EXIT_ROW) goals.push(neighbor);
      }
      neighbors[index].push(neighbor);
    });
  }

  const distance = new Int16Array(states.length);
  distance.fill(-1);
  const back = [];
  for (const goal of goals) {
    distance[goal] = 0;
    back.push(goal);
  }
  head = 0;
  while (head < back.length) {
    const index = back[head];
    head += 1;
    const nextDistance = distance[index] + 1;
    const linked = neighbors[index];
    for (let i = 0; i < linked.length; i += 1) {
      const neighbor = linked[i];
      if (distance[neighbor] >= 0) continue;
      distance[neighbor] = nextDistance;
      back.push(neighbor);
    }
  }

  distanceMap = new Map();
  for (let i = 0; i < states.length; i += 1) {
    if (distance[i] >= 0) distanceMap.set(keyState(states[i]), distance[i]);
  }
  distanceStats = { states: distanceMap.size, buildMs: performance.now() - started };
  return distanceStats;
}

/**
 * @param {Piece[]} pieces
 * @returns {number | null}
 */
export function distanceToGoal(pieces) {
  warmDistanceMap();
  const packed = packPieces(pieces);
  if (!packed || !distanceMap) return null;
  const distance = distanceMap.get(keyState(packed));
  return distance == null ? null : distance;
}

/**
 * The next slide on a shortest path from this board to the exit.
 * @param {Piece[]} pieces
 * @returns {{ status: "ok", id: string, col: number, row: number, fromCol: number, fromRow: number, distance: number } | { status: "solved" } | { status: "none" }}
 */
export function hintMove(pieces) {
  if (isWin(pieces)) return { status: "solved" };
  const distance = distanceToGoal(pieces);
  if (distance == null) return { status: "none" };
  let best = null;
  for (const piece of pieces) {
    const slides = legalSlides(pieces, piece.id);
    for (const slide of slides) {
      const next = applySlide(pieces, piece.id, slide.col, slide.row);
      const nextDistance = distanceToGoal(next);
      if (nextDistance == null) continue;
      if (!best || nextDistance < best.distance) {
        best = {
          status: "ok",
          id: piece.id,
          col: slide.col,
          row: slide.row,
          fromCol: piece.col,
          fromRow: piece.row,
          distance: nextDistance,
        };
      }
    }
  }
  return best ?? { status: "none" };
}

/**
 * @returns {{ states: number, buildMs: number } | null}
 */
export function distanceMapStats() {
  return distanceStats;
}
