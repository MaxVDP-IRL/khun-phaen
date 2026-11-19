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
  "H H V .",
  "H H V o",
  ". V V V",
  "o V V V",
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
  assert.equal(hero.dot, "white");
  assert.deepEqual([hero.col, hero.row], [0, 0]);
  for (const id of ["v-a", "v-b", "v-c", "v-d", "h-front"]) {
    assert.equal(findPiece(pieces, id).dot, "red");
  }
  for (const id of ["s-blue-top", "s-blue-left", "s-blue-mid", "s-blue-right"]) {
    assert.equal(findPiece(pieces, id).dot, "blue");
  }
  assert.deepEqual(
    ["v-a", "v-b", "v-c", "v-d"].map((id) => {
      const piece = findPiece(pieces, id);
      return [piece.col, piece.row];
    }),
    [[2, 0], [1, 2], [2, 2], [3, 2]],
  );
  assert.deepEqual(
    ["s-blue-top", "s-blue-left", "s-blue-mid", "s-blue-right"].map((id) => {
      const piece = findPiece(pieces, id);
      return [piece.col, piece.row];
    }),
    [[3, 1], [0, 3], [2, 4], [3, 4]],
  );
});

test("blocks slide only through empty cells in a straight line", () => {
  const pieces = createInitialPieces();
  const heroSlides = legalSlides(pieces, "hero");
  assert.deepEqual(heroSlides, []);

  const leftBlue = legalSlides(pieces, "s-blue-left");
  assert.deepEqual(
    leftBlue.map((slide) => [slide.col, slide.row, slide.steps]),
    [[0, 2, 1]],
  );

  const topBlue = legalSlides(pieces, "s-blue-top");
  assert.deepEqual(
    topBlue.map((slide) => [slide.col, slide.row, slide.steps]),
    [[3, 0, 1]],
  );

  assert.deepEqual(legalSlides(pieces, "h-front"), []);
  assert.deepEqual(legalSlides(pieces, "v-b"), []);
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
  const open = createGame([
    { id: "runner", role: "small", w: 1, h: 1, col: 0, row: 0, dot: "blue" },
    { id: "peg", role: "small", w: 1, h: 1, col: 0, row: 2, dot: "red" },
  ]);
  const first = performMove(open, "runner", 2, 0);
  assert.equal(first.moved, true);
  assert.equal(first.state.moves, 1);
  assert.equal(first.state.won, false);
  assert.equal(findPiece(first.state.pieces, "runner").col, 2);

  const photo = performMove(createGame(), "s-blue-left", 0, 2);
  assert.equal(photo.moved, true);
  assert.equal(photo.state.moves, 1);
  assert.equal(findPiece(photo.state.pieces, "s-blue-left").row, 2);

  const illegal = performMove(createGame(), "s-blue-left", 1, 2);
  assert.equal(illegal.moved, false);
  assert.equal(illegal.state.moves, 0);
  assert.equal(renderGrid(illegal.state.pieces), INITIAL_GRID);
});

test("undo puts the block and the counter back", () => {
  let game = createGame();
  game = performMove(game, "s-blue-left", 0, 2).state;
  game = performMove(game, "s-blue-top", 3, 0).state;
  assert.equal(game.moves, 2);

  game = undoMove(game);
  assert.equal(game.moves, 1);
  assert.equal(findPiece(game.pieces, "s-blue-top").row, 1);
  assert.equal(findPiece(game.pieces, "s-blue-left").row, 2);

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

test("the photo layout solves in 78 straight slides", { timeout: 20_000 }, () => {
  const pieces = createInitialPieces();
  const result = solve(pieces);
  assert.ok(result);
  assert.equal(result.moveCount, 78);
  assert.equal(result.moves.length, 78);
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
