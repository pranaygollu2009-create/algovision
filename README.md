# AlgoVision — See How Algorithms Work

An interactive algorithm visualizer for CS students, built with **zero frameworks and no build step** — just plain HTML, CSS, and vanilla JavaScript. Algorithms execute for real in the browser (not pre-recorded animations), so every animation frame is an actual algorithm step.

**[Open the app](index.html)** — clone the repo and open `index.html`, or serve the folder with any static server.

## What's inside

| View | What it shows |
|---|---|
| **Sorting** | Animated Bubble Sort & Merge Sort as live bars, with color-coded comparisons and writes, array size (10–160), speed control, four input shapes (random / nearly sorted / reversed / few unique), pause/stop, and live op counters. Includes a step-by-step explainer. |
| **Pathfinding** | A 21×51 drawable grid for Breadth-First Search. Drag to paint/erase walls, move the start and target, or generate a random maze. Watch the frontier spread in rings, then the shortest path light up. Fully walled-off targets correctly report "No path". |
| **Compare** | Runs both sorting algorithms on *identical* arrays across multiple trials and reports median comparisons, array writes, and wall time with proportional charts — visualizing the O(n²) vs O(n log n) gap empirically. |

## How it works

Each algorithm is written exactly like the classroom pseudocode, plus one trick: after every compare/swap/write it updates the DOM and `await sleep(speed)` — yielding to the browser so it can repaint, which turns real execution into an animation. A "run ID" generation token makes Stop and grid editing instantly cancel any running animation, and editing cancels a running search cleanly.

Operation **counters** are used instead of raw timing for fairness: percentiles of comparisons/writes are deterministic, while wall-clock time is polluted by JIT warmup and system load. (Wall time is shown alongside for reference.)

## Files

- `index.html` — markup, three views, legends, explainers
- `styles.css` — dark theme, all state colors
- `app.js` — helpers · sorting · pathfinding · comparison

No dependencies.