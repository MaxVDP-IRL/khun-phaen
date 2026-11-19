# Khun Phaen

A wooden sliding-block puzzle for a phone. Help the crowned block with the white dot — Khun Phaen — slip out through the sunny gap at the bottom of the tray.

## How to play

The tray is the one in the photo: four columns, five rows, and a gap in the rail nearest you.

- Drag or swipe a block in a straight line. It slides into empty space and stops when it meets another block.
- Each slide counts as one move. The big number is your count.
- The star remembers the fewest moves on this phone.
- The curved arrow steps back one slide. The round arrow starts the tray over.
- The speaker stays quiet until you tap it. Then a slide ticks, and the escape gets a short cheer.
- Khun Phaen is free when the big square sits in the gap. He slides out, and you can play again.

## The layout

The photograph is the wooden Khun Phaen / Klotski tray: a 4×5 board, ten blocks (one 2×2, five 1×2, four 1×1) and two empty cells. The gap in the near rail is two cells wide, in the middle.

A closer look at the photo fixes the piece sizes. The big square, with the white dot, sits at the far left. Four tall red blocks, one wide red block and four small blue squares fill the rest. The left-hand blue square sits in the row just above the wide block, with an empty cell above it. The near edge, with the exit, is the bottom row:

```
H H V .
H H V o
. V V V
o V V V
= = o o
```

`H` is Khun Phaen (white dot), `V` a tall red block, `=` the wide red block, `o` a small blue square, `.` an empty cell.

A breadth-first search of straight slides (one gesture, any distance, no corner in the same move) solves this position in **78 moves**. The same search reproduces the published 90-move straight-slide optimum for classic Klotski, which is the check that the rules are counting the way Klotski does.

## Tests

```
node --test
```

No install and no build. The tests cover the slide rules, the win check, undo, and the solver.

## GitHub Pages

The site is static files at the repository root. There is no build step. Paths are relative, so it works from a project site.

1. Open the repository on GitHub.
2. Go to **Settings**.
3. Open **Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose the `main` branch and the folder **/ (root)**.
6. Save.

After it finishes publishing, the game is at `https://<user>.github.io/<repo>/`. On a phone, open that page and use **Add to Home Screen**. It opens full screen in portrait.
