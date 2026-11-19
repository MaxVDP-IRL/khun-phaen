import {
  COLS,
  createGame,
  createInitialPieces,
  legalSlides,
  performMove,
  undoMove,
} from "./puzzle.js";

// v2: the hero is the white 2×2 from the photo, so an old red-hero score does not carry over.
const BEST_KEY = "khun-phaen-best-v2";
const SOUND_KEY = "khun-phaen-sound";

const tray = document.getElementById("tray");
const board = document.getElementById("board");
const moveCountEl = document.getElementById("move-count");
const bestCountEl = document.getElementById("best-count");
const bestWrap = document.getElementById("best");
const undoBtn = document.getElementById("undo");
const restartBtn = document.getElementById("restart");
const soundBtn = document.getElementById("sound");
const winLayer = document.getElementById("win");
const winNum = document.getElementById("win-num");
const winStar = document.getElementById("win-star");
const againBtn = document.getElementById("again");
const confetti = document.getElementById("confetti");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/** @type {ReturnType<typeof createGame>} */
let state = createGame();
/** @type {Map<string, HTMLElement>} */
const blocks = new Map();
let cell = 0;
let soundOn = false;
/** @type {AudioContext | null} */
let audioCtx = null;
let winTimer = 0;

/** @type {null | {
 *   id: string,
 *   pointerId: number,
 *   el: HTMLElement,
 *   startX: number,
 *   startY: number,
 *   baseLeft: number,
 *   baseTop: number,
 *   originCol: number,
 *   originRow: number,
 *   axis: "x" | "y" | null,
 *   range: { min: number, max: number },
 *   lastX: number,
 *   lastY: number,
 *   lastT: number,
 *   vx: number,
 *   vy: number,
 * }} */
let drag = null;

function syncMotion() {
  document.documentElement.classList.toggle("reduce-motion", reduceMotion.matches);
}

function readBest() {
  try {
    const value = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeBest(moves) {
  const previous = readBest();
  const isNew = previous == null || moves < previous;
  const best = isNew ? moves : previous;
  if (isNew) {
    try {
      localStorage.setItem(BEST_KEY, String(moves));
    } catch {
      /* private mode */
    }
  }
  return { best, isNew };
}

function readSound() {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

function paintHud() {
  moveCountEl.textContent = String(state.moves);
  const best = readBest();
  bestCountEl.textContent = best == null ? "–" : String(best);
  bestWrap.classList.toggle("has-best", best != null);
  undoBtn.disabled = state.history.length === 0 || state.won;
}

function bumpMoves() {
  if (reduceMotion.matches) return;
  moveCountEl.classList.remove("bump");
  // Restart the animation if moves come quickly.
  void moveCountEl.offsetWidth;
  moveCountEl.classList.add("bump");
}

function gapSize() {
  return Math.max(4, Math.round(cell * 0.07));
}

function pieceBox(col, row, w, h) {
  const gap = gapSize();
  return {
    left: Math.round(col * cell + gap / 2),
    top: Math.round(row * cell + gap / 2),
    width: Math.round(w * cell - gap),
    height: Math.round(h * cell - gap),
  };
}

function placePiece(piece, animate) {
  const el = blocks.get(piece.id);
  if (!el || cell <= 0) return;
  const box = pieceBox(piece.col, piece.row, piece.w, piece.h);
  el.classList.toggle("no-slide", !animate);
  el.style.width = `${box.width}px`;
  el.style.height = `${box.height}px`;
  el.style.left = `${box.left}px`;
  el.style.top = `${box.top}px`;
  el.style.borderRadius = `${Math.round(cell * 0.12)}px`;
  const dot = Math.round(cell * (piece.role === "hero" ? 0.52 : 0.4));
  el.style.setProperty("--dot", `${dot}px`);
}

function placeAll(animate) {
  for (const piece of state.pieces) placePiece(piece, animate);
}

function fitTray() {
  const stage = document.querySelector(".stage");
  const bounds = stage.getBoundingClientRect();
  const style = getComputedStyle(stage);
  const availW = bounds.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const availH = bounds.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const ratio = 4.55 / 5.7;
  let width = availW;
  let height = width / ratio;
  if (height > availH) {
    height = availH;
    width = height * ratio;
  }
  tray.style.width = `${Math.floor(width)}px`;
  tray.style.height = `${Math.floor(height)}px`;
  const lip = Math.max(12, Math.round(width * 0.078));
  tray.style.gridTemplateColumns = `${lip}px repeat(4, 1fr) ${lip}px`;
  tray.style.gridTemplateRows = `${lip}px minmax(0, 1fr) ${lip}px`;
  cell = board.clientWidth / COLS;
}

function layout(animate) {
  fitTray();
  placeAll(animate);
}

function crownMarkup() {
  return `<svg class="crown" viewBox="0 0 64 36" aria-hidden="true">
    <path d="M4 30 10 12l14 10L32 6l8 16 14-10 6 18z"/>
    <circle cx="10" cy="12" r="3.2"/>
    <circle cx="32" cy="7" r="3.2"/>
    <circle cx="54" cy="12" r="3.2"/>
  </svg>`;
}

function buildBoard() {
  const tones = ["0", "1", "2"];
  createInitialPieces().forEach((piece, index) => {
    const el = document.createElement("div");
    el.className = `block role-${piece.role} tone-${tones[index % tones.length]}`;
    el.dataset.id = piece.id;
    el.setAttribute("role", "button");
    el.tabIndex = -1;
    if (piece.role === "hero") {
      el.setAttribute("aria-label", "Khun Phaen");
      el.innerHTML = `${crownMarkup()}
        <span class="face" aria-hidden="true">
          <span class="eye"></span>
          <span class="eye"></span>
          <span class="smile"></span>
        </span>
        <span class="dot dot-${piece.dot}"></span>`;
    } else {
      el.setAttribute("aria-label", "Block");
      el.innerHTML = `<span class="dot dot-${piece.dot}"></span>`;
    }
    board.appendChild(el);
    blocks.set(piece.id, el);
  });
}

function axisRange(id, originCol, originRow, axis) {
  let min = 0;
  let max = 0;
  for (const slide of legalSlides(state.pieces, id)) {
    if (axis === "x" && slide.row === originRow) {
      const delta = slide.col - originCol;
      min = Math.min(min, delta);
      max = Math.max(max, delta);
    }
    if (axis === "y" && slide.col === originCol) {
      const delta = slide.row - originRow;
      min = Math.min(min, delta);
      max = Math.max(max, delta);
    }
  }
  return { min, max };
}

function onPointerDown(event) {
  if (state.won || drag) return;
  const el = event.target.closest(".block");
  if (!el || !board.contains(el)) return;
  event.preventDefault();
  const id = el.dataset.id;
  const piece = state.pieces.find((item) => item.id === id);
  if (!piece) return;
  el.setPointerCapture(event.pointerId);
  drag = {
    id,
    pointerId: event.pointerId,
    el,
    startX: event.clientX,
    startY: event.clientY,
    baseLeft: el.offsetLeft,
    baseTop: el.offsetTop,
    originCol: piece.col,
    originRow: piece.row,
    axis: null,
    range: { min: 0, max: 0 },
    lastX: event.clientX,
    lastY: event.clientY,
    lastT: performance.now(),
    vx: 0,
    vy: 0,
  };
}

function onPointerMove(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  event.preventDefault();
  const now = performance.now();
  const dt = Math.max(8, now - drag.lastT);
  drag.vx = (event.clientX - drag.lastX) / dt;
  drag.vy = (event.clientY - drag.lastY) / dt;
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
  drag.lastT = now;

  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  if (!drag.axis) {
    if (Math.hypot(dx, dy) < 8) return;
    drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    drag.range = axisRange(drag.id, drag.originCol, drag.originRow, drag.axis);
  }

  const range = drag.range;
  let delta = drag.axis === "x" ? dx : dy;
  const minPx = range.min * cell;
  const maxPx = range.max * cell;
  delta = Math.max(minPx, Math.min(maxPx, delta));
  drag.el.classList.add("dragging");
  if (drag.axis === "x") {
    drag.el.style.left = `${drag.baseLeft + delta}px`;
    drag.el.style.top = `${drag.baseTop}px`;
  } else {
    drag.el.style.left = `${drag.baseLeft}px`;
    drag.el.style.top = `${drag.baseTop + delta}px`;
  }
}

function finishDrag(event) {
  if (!drag || (event && event.pointerId !== drag.pointerId)) return;
  const current = drag;
  drag = null;
  current.el.classList.remove("dragging");

  let steps = 0;
  if (current.axis) {
    const delta =
      current.axis === "x"
        ? current.lastX - current.startX
        : current.lastY - current.startY;
    const velocity = current.axis === "x" ? current.vx : current.vy;
    steps = Math.round(delta / cell);
    const flicked = Math.abs(delta) < cell * 0.5 && Math.abs(velocity) > 0.4;
    if (flicked) steps = velocity > 0 ? 1 : -1;
    if (Math.abs(delta) < 10 && Math.abs(velocity) < 0.4) steps = 0;
    steps = Math.max(current.range.min, Math.min(current.range.max, steps));
  }

  if (current.axis && current.range.min === 0 && current.range.max === 0 && Math.hypot(
    current.lastX - current.startX,
    current.lastY - current.startY,
  ) > 8) {
    shake(current.el);
  }

  if (steps !== 0) {
    const col = current.originCol + (current.axis === "x" ? steps : 0);
    const row = current.originRow + (current.axis === "y" ? steps : 0);
    const result = performMove(state, current.id, col, row);
    if (result.moved) {
      state = result.state;
      woodTick();
      placeAll(true);
      paintHud();
      bumpMoves();
      if (state.won) beginEscape();
      return;
    }
  }
  placeAll(true);
}

function shake(el) {
  if (reduceMotion.matches) return;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  el.addEventListener("animationend", () => el.classList.remove("shake"), { once: true });
}

function beginEscape() {
  undoBtn.disabled = true;
  const hero = blocks.get("hero");
  tray.classList.add("free");
  const extra = cell * 1.05;
  if (reduceMotion.matches) {
    hero.style.opacity = "0";
    showWin();
    return;
  }
  hero.classList.add("escaping");
  hero.style.top = `${parseFloat(hero.style.top) + extra}px`;
  clearTimeout(winTimer);
  winTimer = window.setTimeout(showWin, 760);
}

function showWin() {
  const { best, isNew } = writeBest(state.moves);
  paintHud();
  winNum.textContent = String(state.moves);
  winStar.hidden = !isNew;
  winLayer.hidden = false;
  spawnConfetti();
  cheer();
  if (isNew && !reduceMotion.matches) bestWrap.classList.add("pop");
}

function hideWin() {
  winLayer.hidden = true;
  confetti.replaceChildren();
  tray.classList.remove("free");
  bestWrap.classList.remove("pop");
  const hero = blocks.get("hero");
  hero.classList.remove("escaping");
  hero.style.opacity = "";
}

function spawnConfetti() {
  confetti.replaceChildren();
  const colors = ["#e23d3d", "#2f6fdb", "#f6c445", "#fff8ea", "#62a83a", "#f08a3e"];
  const count = reduceMotion.matches ? 12 : 40;
  for (let i = 0; i < count; i += 1) {
    const bit = document.createElement("i");
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 190;
    bit.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    bit.style.setProperty("--dy", `${Math.sin(angle) * dist - 20}px`);
    bit.style.setProperty("--rot", `${Math.random() * 540 - 180}deg`);
    bit.style.setProperty("--delay", `${Math.random() * 90}ms`);
    bit.style.background = colors[i % colors.length];
    const kind = i % 5;
    bit.className = kind === 0 ? "bit star" : kind === 1 ? "bit round" : "bit";
    if (kind === 0) {
      bit.textContent = "★";
      bit.style.background = "none";
    }
    confetti.appendChild(bit);
  }
}

function resetGame() {
  clearTimeout(winTimer);
  drag = null;
  state = createGame();
  hideWin();
  for (const el of blocks.values()) {
    el.classList.remove("dragging", "escaping", "shake");
    el.style.opacity = "";
  }
  placeAll(false);
  paintHud();
}

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(frequency, when, duration, type, gainValue) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(gainValue, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

function woodTick() {
  if (!soundOn) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(210, now, 0.05, "sine", 0.06);
  tone(90, now, 0.07, "triangle", 0.04);
}

function cheer() {
  if (!soundOn) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    tone(frequency, now + index * 0.09, 0.28, "triangle", 0.07);
  });
}

function setSound(on) {
  soundOn = on;
  soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
  soundBtn.setAttribute("aria-label", on ? "Sound on" : "Sound off");
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

function onUndo() {
  if (state.won || state.history.length === 0) return;
  state = undoMove(state);
  placeAll(true);
  paintHud();
}

board.addEventListener("pointerdown", onPointerDown);
document.addEventListener("pointermove", onPointerMove, { passive: false });
document.addEventListener("pointerup", finishDrag);
document.addEventListener("pointercancel", finishDrag);
board.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
document.addEventListener("gesturestart", (event) => event.preventDefault());

undoBtn.addEventListener("click", onUndo);
restartBtn.addEventListener("click", resetGame);
againBtn.addEventListener("click", resetGame);
soundBtn.addEventListener("click", () => {
  const next = !soundOn;
  setSound(next);
  if (next) {
    ensureAudio();
    woodTick();
  }
});

reduceMotion.addEventListener("change", syncMotion);
window.addEventListener("resize", () => {
  drag = null;
  layout(false);
});

buildBoard();
syncMotion();
soundOn = readSound();
setSound(soundOn);
layout(false);
paintHud();
