import assert from "node:assert/strict";
import test from "node:test";
import {
  COLS,
  EXIT_COL,
  EXIT_ROW,
  ROWS,
  applySlide,
  coveredCells,
  createGame,
  createInitialPieces,
  findPiece,
  fits,
  isWin,
  legalSlides,
  occupancy,
  performMove,
  renderGrid,
  replay,
  solve,
  undoMove,
} from "../js/puzzle.js";

const INITIAL_GRID = [
  "o H H V",
  "V H H V",
  "V = = V",
  "o . . V",
  "= = o o",
].join("\n");

/** Classic Klotski (横刀立马). Straight slides, not corner-as-one-move. */
function classicKlotski() {
  return [
    { id: "hero", role: "hero", w: 2, h: 2, col: 1, row: 0, dot: "red" },
    { id: "v1", role: "vert", w: 1, h: 2, col: 0, row: 0, dot: "red" },
    { id: "v2", role: "vert", w: 1, h: 2, col: 3, row: 0, dot: "blue" },
    { id: "v3", role: "vert", w: 1, h: 2, col: 0, row: 2, dot: "red" },
    { id: "v4", role: "vert", w: 1, h: 2, col: 3, row: 2, dot: "blue" },
    { id: "h", role: "horiz", w: 2, h: 1, col: 1, row: 2, dot: "red" },
    { id: "s1", role: "small", w: 1, h: 1, col: 1, row: 3, dot: "blue" },
    { id: "s2", role: "small", w: 1, h: 1, col: 2, row: 3, dot: "blue" },
    { id: "s3", role: "small", w: 1, h: 1, col: 0, row: 4, dot: "white" },
    { id: "s4", role: "small", w: 1, h: 1, col: 3, row: 4, dot: "blue" },
  ];
}

test("the photo layout is a full tray with no overlaps", () => {
  const pieces = createInitialPieces();
  assert.equal(pieces.length, 10);
  assert.equal(renderGrid(pieces), INITIAL_GRID);
  const cells = coveredCells(pieces);
  assert.equal(cells.size, 18);
  for (const key of cells.keys()) {
    const [col, row] = key.split(",").map(Number);
    assert.ok(col >= 0 && col < COLS && row >= 0 && row < ROWS);
    assert.notEqual(cells.get(key), "overlap");
  }
  assert.equal(isWin(pieces), false);
  const hero = findPiece(pieces, "hero");
  assert.equal(hero.w, 2);
  assert.equal(hero.h, 2);
  assert.equal(hero.dot, "red");
});

test("blocks slide only through empty cells in a straight line", () => {
  const pieces = createInitialPieces();
  const heroSlides = legalSlides(pieces, "hero");
  assert.deepEqual(heroSlides, []);

  const bar = legalSlides(pieces, "h-mid");
  assert.deepEqual(
    bar.map((slide) => [slide.col, slide.row, slide.steps]),
    [[1, 3, 1]],
  );

  const blue = legalSlides(pieces, "s-blue-left");
  assert.deepEqual(
    blue.map((slide) => [slide.col, slide.row, slide.steps]).sort(),
    [
      [1, 3, 1],
      [2, 3, 2],
    ].sort(),
  );

  const front = legalSlides(pieces, "s-blue-mid");
  assert.ok(front.some((slide) => slide.col === 2 && slide.row === 3 && slide.steps === 1));
  assert.equal(front.some((slide) => slide.row === 4 && slide.col !== 2), false);
});

test("a block cannot jump a neighbour or leave the tray", () => {
  const pieces = [
    { id: "hero", role: "hero", w: 2, h: 2, col: 0, row: 0, dot: "red" },
    { id: "wall", role: "small", w: 1, h: 1, col: 2, row: 0, dot: "blue" },
    { id: "runner", role: "small", w: 1, h: 1, col: 0, row: 4, dot: "red" },
  ];
  const slides = legalSlides(pieces, "runner");
  const cols = slides.filter((slide) => slide.row === 4).map((slide) => slide.col);
  assert.deepEqual(cols.sort((a, b) => a - b), [1, 2, 3]);
  assert.equal(slides.some((slide) => slide.col < 0 || slide.row < 0), false);
  assert.equal(slides.some((slide) => slide.col === 2 && slide.row === 0), false);

  const grid = occupancy(pieces, "hero");
  assert.equal(fits(grid, 2, 2, 2, 0), false);
  assert.equal(fits(grid, 2, 2, -1, 0), false);
  assert.equal(fits(grid, 2, 2, 2, 2), true);
});

test("one gesture is one move, even when the block travels two cells", () => {
  const first = performMove(createGame(), "s-blue-left", 2, 3);
  assert.equal(first.moved, true);
  assert.equal(first.state.moves, 1);
  assert.equal(first.state.won, false);
  assert.equal(findPiece(first.state.pieces, "s-blue-left").col, 2);
  assert.equal(findPiece(first.state.pieces, "s-blue-left").row, 3);

  const illegal = performMove(createGame(), "s-blue-left", 3, 3);
  assert.equal(illegal.moved, false);
  assert.equal(illegal.state.moves, 0);
  assert.equal(renderGrid(illegal.state.pieces), INITIAL_GRID);

  const diagonal = performMove(createGame(), "s-blue-left", 1, 4);
  assert.equal(diagonal.moved, false);
});

test("undo puts the block and the counter back", () => {
  let game = createGame();
  game = performMove(game, "h-mid", 1, 3).state;
  game = performMove(game, "hero", 1, 1).state;
  assert.equal(game.moves, 2);

  game = undoMove(game);
  assert.equal(game.moves, 1);
  assert.equal(findPiece(game.pieces, "hero").row, 0);
  assert.equal(findPiece(game.pieces, "h-mid").row, 3);

  game = undoMove(game);
  assert.equal(game.moves, 0);
  assert.equal(renderGrid(game.pieces), INITIAL_GRID);
  assert.equal(undoMove(game), game);
});

test("the win check is only the hero sitting in the exit", () => {
  const parked = createInitialPieces();
  assert.equal(isWin(parked), false);

  const almost = applySlide(parked, "hero", EXIT_COL, EXIT_ROW - 1);
  assert.equal(isWin(almost), false);

  const escaped = applySlide(parked, "hero", EXIT_COL, EXIT_ROW);
  assert.equal(isWin(escaped), true);
  assert.equal(isWin(applySlide(parked, "hero", 0, EXIT_ROW)), false);

  const ready = [
    { id: "hero", role: "hero", w: 2, h: 2, col: 1, row: 2, dot: "red" },
    { id: "peg", role: "small", w: 1, h: 1, col: 0, row: 0, dot: "blue" },
  ];
  const slide = performMove(createGame(ready), "hero", 1, 3);
  assert.equal(slide.moved, true);
  assert.equal(slide.state.moves, 1);
  assert.equal(slide.state.won, true);
  const after = performMove(slide.state, "peg", 1, 0);
  assert.equal(after.moved, false);
  assert.equal(after.state.won, true);
  const undone = undoMove(slide.state);
  assert.equal(undone.won, false);
  assert.equal(undone.moves, 0);
  assert.equal(isWin(undone.pieces), false);
});

test("a two-move escape is found in two slides", () => {
  const pieces = [
    { id: "ha", role: "horiz", w: 2, h: 1, col: 0, row: 0, dot: "red" },
    { id: "hb", role: "horiz", w: 2, h: 1, col: 0, row: 1, dot: "red" },
    { id: "vc", role: "vert", w: 1, h: 2, col: 2, row: 0, dot: "blue" },
    { id: "vd", role: "vert", w: 1, h: 2, col: 3, row: 0, dot: "blue" },
    { id: "vr", role: "vert", w: 1, h: 2, col: 0, row: 2, dot: "red" },
    { id: "hero", role: "hero", w: 2, h: 2, col: 1, row: 2, dot: "red" },
    { id: "s1", role: "small", w: 1, h: 1, col: 3, row: 2, dot: "blue" },
    { id: "s2", role: "small", w: 1, h: 1, col: 3, row: 3, dot: "white" },
    { id: "s3", role: "small", w: 1, h: 1, col: 0, row: 4, dot: "blue" },
    { id: "blocker", role: "small", w: 1, h: 1, col: 2, row: 4, dot: "red" },
  ];
  assert.equal(coveredCells(pieces).size, 18);
  assert.equal(isWin(pieces), false);
  const result = solve(pieces);
  assert.ok(result);
  assert.equal(result.moveCount, 2);
  assert.equal(isWin(replay(pieces, result.moves)), true);
});

test("classic Klotski solves in 90 straight slides", { timeout: 20_000 }, () => {
  const pieces = classicKlotski();
  const result = solve(pieces);
  assert.ok(result);
  assert.equal(result.moveCount, 90);
  let current = pieces;
  for (let i = 0; i < result.moves.length; i += 1) {
    const move = result.moves[i];
    assert.equal(isLegal(current, move.id, move.col, move.row), true);
    current = applySlide(current, move.id, move.col, move.row);
    assert.equal(isWin(current), i === result.moves.length - 1);
  }
});

test("the photo layout solves in 75 straight slides", { timeout: 20_000 }, () => {
  const pieces = createInitialPieces();
  const result = solve(pieces);
  assert.ok(result);
  assert.equal(result.moveCount, 75);
  assert.equal(result.moves.length, 75);
  let current = pieces;
  for (let i = 0; i < result.moves.length; i += 1) {
    const move = result.moves[i];
    const slides = legalSlides(current, move.id);
    assert.ok(
      slides.some((slide) => slide.col === move.col && slide.row === move.row),
      `move ${i} is not a legal straight slide`,
    );
    current = applySlide(current, move.id, move.col, move.row);
    const cells = coveredCells(current);
    assert.equal(cells.size, 18);
    assert.equal([...cells.values()].includes("overlap"), false);
    assert.equal(isWin(current), i === result.moves.length - 1);
  }
});

function isLegal(pieces, id, col, row) {
  return legalSlides(pieces, id).some((slide) => slide.col === col && slide.row === row);
}
