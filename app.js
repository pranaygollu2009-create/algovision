/* ============================================================
   AlgoVision — vanilla-JS algorithm visualizer
   Sections: helpers · sorting · pathfinding · comparison
   ============================================================ */
(() => {
  "use strict";

  /* ---------- helpers & shared UI ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // view switching — tabs, the brand button and home quick-links all share [data-nav]
  const showView = (name) => {
    document.querySelectorAll(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.view === name)
    );
    document.querySelectorAll(".view").forEach((v) =>
      v.classList.toggle("active", v.id === `view-${name}`)
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  document.querySelectorAll("[data-nav]").forEach((el) =>
    el.addEventListener("click", () => {
      if (el.dataset.view) showView(el.dataset.view);
    })
  );

  /* ============================================================
     SORTING — animated bubble & merge sorts
     ============================================================ */
  const sortUI = {
    algo: $("#sort-algo"),
    shape: $("#sort-shape"),
    size: $("#sort-size"),
    speed: $("#sort-speed"),
    sizeLabel: $("#size-label"),
    speedLabel: $("#speed-label"),
    bars: $("#sort-bars"),
    run: $("#sort-run"),
    pause: $("#sort-pause"),
    stop: $("#sort-stop"),
    shuffleBtn: $("#sort-shuffle"),
    stComp: $("#st-comp"),
    stWrites: $("#st-writes"),
    stWork: $("#st-work"),
    stMsg: $("#st-msg"),
    explain: $("#sort-explain"),
  };

  const ALGOS = {
    bubble: {
      name: "Bubble Sort",
      work: "O(n²)",
      explain:
        "<p><strong>Bubble Sort</strong> repeatedly walks across the array, compares each pair of neighbours " +
        "and swaps them if they are out of order. After the first pass the largest value has “bubbled” to the " +
        "far right; after the second pass, the two largest are in place, and so on.</p>" +
        "<p><span class='mono' style='color:var(--hot)'>Orange</span> marks the pair being compared and " +
        "<span class='mono' style='color:var(--danger)'>red</span> marks a write. When a whole pass finishes with " +
        "no swap, the algorithm stops early — watch how a <em>nearly sorted</em> input finishes almost instantly " +
        "while a <em>reversed</em> one takes the maximum number of comparisons.</p>" +
        "<p>Time: O(n²) worst case, O(n) on already-sorted input with early exit. Space: O(1).</p>",
    },
    merge: {
      name: "Merge Sort",
      work: "O(n log n)",
      explain:
        "<p><strong>Merge Sort</strong> is divide-and-conquer: split the array in half, recursively sort each " +
        "half, then <em>merge</em> the two sorted halves by repeatedly taking whichever front element is smaller.</p>" +
        "<p>The shrinking red-free green blanket grows because each small region gets sorted before anything bigger " +
        "is touched — halving the problem costs only O(log n) levels, and each level merges O(n) elements total. " +
        "That product is where the O(n log n) guarantee comes from.</p>" +
        "<p>Space: O(n) auxiliary memory. Its gentle cost curve is why every serious sort in real libraries is " +
        "a descendant of merge sort.</p>",
    },
  };

  let bars = [];
  let currentArray = [];
  let sortRunId = 0;      // generation token — stale animations stop touching the DOM
  let paused = false;
  let counts = { comp: 0, writes: 0 };

  // 1..100 → ~380ms..6ms (chip-scale fine control at the fast end)
  const speedMs = (slider) => Math.max(6, Math.round(380 * Math.exp(-(Number(slider.value) / 100) * Math.log(380 / 6))));

  function makeArray(size, shape) {
    const a = [];
    if (shape === "random") {
      for (let i = 0; i < size; i++) a.push(5 + Math.round(95 * Math.random()));
    } else if (shape === "nearly") {
      for (let i = 0; i < size; i++) a.push(6 + Math.round(94 * (i / Math.max(1, size - 1))));
      for (let k = 0; k < Math.max(1, Math.round(size * 0.06)); k++) {
        const i = Math.floor(Math.random() * size);
        const j = Math.min(size - 1, i + 1 + Math.floor(Math.random() * 3));
        [a[i], a[j]] = [a[j], a[i]];
      }
    } else if (shape === "reversed") {
      for (let i = 0; i < size; i++) a.push(Math.round(100 - 95 * (i / Math.max(1, size - 1))));
    } else { // few unique
      const levels = [12, 40, 68, 95];
      for (let i = 0; i < size; i++) a.push(levels[Math.floor(Math.random() * levels.length)]);
    }
    return a;
  }

  function renderBars(arr, tag = {}) {
    if (bars.length !== arr.length || sortUI.bars.children.length !== arr.length) {
      sortUI.bars.innerHTML = "";
      bars = arr.map(() => { const d = document.createElement("div"); d.className = "bar"; sortUI.bars.appendChild(d); return d; });
    }
    const max = Math.max(...arr, 1);
    arr.forEach((v, i) => {
      const b = bars[i];
      b.style.height = `${(v / max) * 100}%`;
      const t = tag[i];
      b.className = "bar" +
        (t === "compare" ? " c-compare" : t === "swap" ? " c-swap" : t === "sorted" ? " c-sorted" : "");
    });
  }

  const setStats = () => {
    sortUI.stComp.textContent = counts.comp.toLocaleString();
    sortUI.stWrites.textContent = counts.writes.toLocaleString();
  };

  async function pauseGate(runId) {
    while (paused && runId === sortRunId) {
      sortUI.stMsg.textContent = "Paused — press Resume to continue";
      await sleep(90);
    }
  }

  async function sortedFinale(arr, runId) {
    for (let i = 0; i < arr.length; i++) {
      if (runId !== sortRunId) return;
      bars[i].className = "bar c-sorted";
      if (i % 4 === 0) await sleep(0);
      await sleep(Math.max(1, 16 / arr.length));
    }
  }

  // Bubble sort with early exit, exactly the classroom algorithm, animated
  async function runBubble(arr, runId) {
    const n = arr.length;
    for (let pass = 0; pass < n - 1; pass++) {
      let swapped = false;
      for (let i = 0; i < n - 1 - pass; i++) {
        if (runId !== sortRunId) return false;
        await pauseGate(runId);
        counts.comp++;
        renderBars(arr, { [i]: "compare", [i + 1]: "compare" });
        await sleep(speedMs(sortUI.speed));
        if (runId !== sortRunId) return false;
        if (arr[i] > arr[i + 1]) {
          [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
          counts.writes += 2;
          renderBars(arr, { [i]: "swap", [i + 1]: "swap" });
          await sleep(speedMs(sortUI.speed));
          swapped = true;
        }
      }
      bars[n - 1 - pass].className = "bar c-sorted";
      setStats();
      if (!swapped) {
        for (let i = 0; i <= n - 1 - pass; i++) bars[i].className = "bar c-sorted";
        break;
      }
    }
    await sortedFinale(arr, runId);
    return true;
  }

  // Merge sort, animated: flashes the region it is merging, then writes values
  async function runMerge(arr, runId, lo = 0, hi = arr.length - 1) {
    if (lo >= hi || runId !== sortRunId) return runId === sortRunId;
    const mid = (lo + hi) >> 1;
    if (!(await runMerge(arr, runId, lo, mid))) return false;
    if (!(await runMerge(arr, runId, mid + 1, hi))) return false;

    const width = hi - lo + 1;
    const stepBytes = width > 80 ? 16 : width > 30 ? 8 : 3; // blend animation speed into range size
    for (const i of [lo, mid, hi]) {
      if (runId !== sortRunId) return false;
      if (bars[i]) bars[i].className = "bar c-swap";
    }
    const ms = speedMs(sortUI.speed) * (width > 60 ? 0.3 : 1);
    await sleep(ms);

    const left = arr.slice(lo, mid + 1);
    const right = arr.slice(mid + 1, hi + 1);
    let li = 0, ri = 0, k = lo;
    let lastPaint = k;
    while (li < left.length && ri < right.length) {
      if (runId !== sortRunId) return false;
      await pauseGate(runId);
      counts.comp++;
      arr[k++] = left[li] <= right[ri] ? left[li++] : right[ri++];
      counts.writes++;
      if (k - lastPaint >= stepBytes || k === hi) {
        renderBars(arr, { ...rangeTag(lo, hi, "compare"), [k - 1]: "swap" });
        lastPaint = k;
        await sleep(ms);
      }
    }
    while (li < left.length) { arr[k] = left[li++]; counts.writes++; k++; }
    while (ri < right.length) { arr[k] = right[ri++]; counts.writes++; k++; }
    renderBars(arr, rangeTag(lo, hi, "sorted"));
    setStats();
    await sleep(ms);
    return runId === sortRunId;
  }

  function rangeTag(lo, hi, label) {
    const t = {};
    for (let i = lo; i <= hi; i++) t[i] = label;
    return t;
  }

  function resetSortState(msg) {
    sortRunId++;
    paused = false;
    counts = { comp: 0, writes: 0 };
    sortUI.run.disabled = false;
    sortUI.pause.disabled = true;
    sortUI.pause.textContent = "Pause";
    sortUI.stMsg.textContent = msg;
    sortUI.stMsg.className = "stat-msg";
  }

  async function runSorting() {
    resetSortState("Running…");
    sortUI.run.disabled = true;
    sortUI.pause.disabled = false;
    sortUI.stMsg.className = "stat-msg running";
    sortUI.stWork.textContent = ALGOS[sortUI.algo.value].work;
    counts = { comp: 0, writes: 0 };
    setStats();

    const runId = ++sortRunId;
    const arr = currentArray.slice();
    renderBars(arr);
    const t0 = performance.now();
    const finished = sortUI.algo.value === "bubble"
      ? await runBubble(arr, runId)
      : await runMerge(arr, runId);
    const ms = performance.now() - t0;

    if (runId !== sortRunId) return;
    sortUI.run.disabled = false;
    sortUI.pause.disabled = true;
    sortUI.pause.textContent = "Pause";
    if (finished) {
      sortUI.stMsg.textContent = `Done — ${counts.writes} writes, ${counts.comp} comparisons, ${ms.toFixed(0)} ms`;
      sortUI.stMsg.className = "stat-msg done";
    }
  }

  function newInput() {
    sortRunId++;
    resetSortState("Ready — press Run to sort");
    currentArray = makeArray(Number(sortUI.size.value), sortUI.shape.value);
    renderBars(currentArray);
  }

  /* sorting events */
  sortUI.sizeLabel.textContent = sortUI.size.value;
  sortUI.speedLabel.textContent = sortUI.speed.value;
  sortUI.size.addEventListener("input", () => { sortUI.sizeLabel.textContent = sortUI.size.value; });
  sortUI.size.addEventListener("change", newInput);
  sortUI.speed.addEventListener("input", () => { sortUI.speedLabel.textContent = sortUI.speed.value; });
  sortUI.shape.addEventListener("change", newInput);
  sortUI.algo.addEventListener("change", () => {
    sortUI.stWork.textContent = ALGOS[sortUI.algo.value].work;
    sortUI.explain.innerHTML = ALGOS[sortUI.algo.value].explain;
  });
  sortUI.run.addEventListener("click", runSorting);
  sortUI.pause.addEventListener("click", () => {
    paused = !paused;
    sortUI.pause.textContent = paused ? "Resume" : "Pause";
  });
  sortUI.stop.addEventListener("click", () => {
    resetSortState("Stopped");
    renderBars(currentArray); // resets all highlighting (bar set is unchanged)
    sortUI.stMsg.textContent = "Stopped";
  });
  sortUI.shuffleBtn.addEventListener("click", newInput);

  sortUI.explain.innerHTML = ALGOS.bubble.explain;
  newInput();

  /* ============================================================
     PATHFINDING — BFS on a drawable grid
     ============================================================ */
  const P = {
    grid: $("#grid"),
    run: $("#path-run"),
    stop: $("#path-stop"),
    clear: $("#path-clear"),
    maze: $("#path-maze"),
    speed: $("#path-speed"),
    speedLabel: $("#path-speed-label"),
    tools: $("#paint-tools"),
    ptVisited: $("#pt-visited"),
    ptPath: $("#pt-path"),
    ptTime: $("#pt-time"),
    ptMsg: $("#pt-msg"),
  };

  const ROWS = 21, COLS = 51;
  const START0 = { r: 10, c: 5 }, TARGET0 = { r: 10, c: 45 };
  const key = (r, c) => `${r},${c}`;
  let wall = new Set();
  let start = { ...START0 }, target = { ...TARGET0 };
  let tool = "wall";
  let painting = false, lastPaint = null;
  let gridRunId = 0;
  let cells = [];

  const cellAt = (r, c) => cells[r * COLS + c];

  function buildGrid() {
    P.grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    P.grid.innerHTML = "";
    cells = [];
    for (let r = 0; r < ROWS * COLS; r++) {
      const d = document.createElement("div");
      d.className = "cell";
      d.dataset.r = Math.floor(r / COLS);
      d.dataset.c = r % COLS;
      P.grid.appendChild(d);
      cells.push(d);
    }
    paintStatic();
  }

  function paintStatic() {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        cellAt(r, c).className = "cell" + (wall.has(key(r, c)) ? " g-wall" : "");
    cellAt(start.r, start.c).className = "cell g-start";
    cellAt(target.r, target.c).className = "cell g-target";
    P.ptMsg.textContent = "Drag on the grid, then press Run BFS";
    P.ptMsg.className = "stat-msg";
  }

  function resetGridStats() {
    P.ptVisited.textContent = "0";
    P.ptPath.textContent = "—";
    P.ptTime.textContent = "—";
  }

  function applyPaint(r, c) {
    if ((r === start.r && c === start.c) || (r === target.r && c === target.c)) return;
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return;
    const el = cellAt(r, c);
    if (tool === "wall") { wall.add(key(r, c)); el.className = "cell g-wall"; }
    else { wall.delete(key(r, c)); el.className = "cell"; }
  }

  function moveWithTool(r, c) {
    if (wall.has(key(r, c))) return;
    cellAt(start.r, start.c).className = "cell";
    cellAt(target.r, target.c).className = "cell";
    if (tool === "start") start = { r, c };
    else target = { r, c };
    paintStatic();
  }

  const cancelUi = () => {
    P.run.disabled = false;
    resetGridStats();
    P.ptMsg.textContent = "Search interrupted — draw again, then press Run BFS";
    P.ptMsg.className = "stat-msg";
  };

  P.grid.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".cell");
    if (!el) return;
    e.preventDefault();
    try { P.grid.setPointerCapture(e.pointerId); } catch { /* synthetic or stale pointer — no capture needed */ }
    const r = +el.dataset.r, c = +el.dataset.c;
    if (gridRunId > 0 && P.run.disabled) cancelUi(); // a run was in progress: editing cancels it
    gridRunId++; // any editing cancels a running search
    resetGridStats();
    if (tool === "start" || tool === "target") { painting = true; moveWithTool(r, c); }
    else { painting = true; applyPaint(r, c); lastPaint = key(r, c); }
  });
  window.addEventListener("pointerup", () => { painting = false; lastPaint = null; });
  // paint on hover-through so fast drags paint a connected line
  P.grid.addEventListener("pointerover", (e) => {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    const r = +cell.dataset.r, c = +cell.dataset.c;
    if (tool === "start" || tool === "target") {
      if (painting) moveWithTool(r, c);
      return;
    }
    if (!painting) return;
    if (lastPaint) {
      const [lr, lc] = lastPaint.split(",").map(Number);
      const dr = r - lr, dc = c - lc;
      const steps = Math.max(Math.abs(dr), Math.abs(dc), 1);
      for (let s = 1; s <= steps; s++)
        applyPaint(Math.round(lr + (dr * s) / steps), Math.round(lc + (dc * s) / steps));
    } else applyPaint(r, c);
    lastPaint = key(r, c);
  });
  // move start/target by click even without a drag
  P.grid.addEventListener("click", (e) => {
    if (painting) return;
    const cell = e.target.closest(".cell");
    if (!cell || (tool !== "start" && tool !== "target")) return;
    const r = +cell.dataset.r, c = +cell.dataset.c;
    moveWithTool(r, c);
  });

  P.tools.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    tool = btn.dataset.tool;
    [...P.tools.children].forEach((b) => b.classList.toggle("active", b === btn));
  });
  P.speedLabel.textContent = P.speed.value;
  P.speed.addEventListener("input", () => { P.speedLabel.textContent = P.speed.value; });

  P.clear.addEventListener("click", () => {
    gridRunId++;
    wall.clear();
    resetGridStats();
    paintStatic();
    P.run.disabled = false;
  });

  P.maze.addEventListener("click", () => {
    gridRunId++;
    resetGridStats();
    wall.clear();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (Math.random() < 0.3) wall.add(key(r, c));
    // carve rooms so the result looks structured, then keep endpoints clear
    for (let i = 0; i < 5; i++) {
      const top = 1 + Math.floor(Math.random() * (ROWS - 7));
      const left = 1 + Math.floor(Math.random() * (COLS - 9));
      for (let r = top; r < top + 6; r++)
        for (let c = left; c < left + 8; c++) wall.delete(key(r, c));
    }
    // carve a horizontal corridor on both endpoints' rows so mazes stay solvable
    for (let c = 0; c < COLS; c++) {
      wall.delete(key(start.r, c));
      wall.delete(key(target.r, c));
    }
    paintStatic();
    P.run.disabled = false;
  });

  async function runBFS() {
    const runId = ++gridRunId;
    resetGridStats();
    P.run.disabled = true;
    P.ptMsg.className = "stat-msg running";
    P.ptMsg.textContent = "Searching…";

    const blocked = new Set(wall);
    blocked.delete(key(start.r, start.c));
    blocked.delete(key(target.r, target.c));

    // BFS: FIFO queue, distance + parent tracking — the textbook setup
    const stepMs = Math.max(2, Math.round(40 * Math.exp(-(Number(P.speed.value) / 100) * Math.log(40 / 2))));
    const dist = new Map([[key(start.r, start.c), 0]]);
    const parent = new Map();
    const q = [[start.r, start.c]];
    let visitedCount = 0, found = false;
    const t0 = performance.now();

    while (q.length && runId === gridRunId) {
      const [r, c] = q.shift();
      visitedCount++;
      const isEndpoint = (r === start.r && c === start.c) || (r === target.r && c === target.c);
      if (!isEndpoint) cellAt(r, c).className = "cell g-visited";
      P.ptVisited.textContent = visitedCount.toLocaleString();
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc, nk = key(nr, nc);
        if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
        if (blocked.has(nk) || dist.has(nk)) continue;
        dist.set(nk, dist.get(r + "," + c) + 1);
        parent.set(nk, key(r, c));
        if (nr === target.r && nc === target.c) { found = true; q.length = 0; break; }
        q.push([nr, nc]);
        cellAt(nr, nc).className = "cell g-frontier";
      }
      if (found) break;
      if (visitedCount % 3 === 0) await sleep(stepMs / 2);
    }
    const elapsed = performance.now() - t0;
    if (runId !== gridRunId) return;
    P.run.disabled = false;

    if (found) {
      const path = [];
      let cur = key(target.r, target.c);
      while (cur !== undefined) {
        const [pr, pc] = cur.split(",").map(Number);
        path.push([pr, pc]);
        cur = parent.get(cur);
        if (pr === start.r && pc === start.c) break;
      }
      path.reverse();
      for (const [r, c] of path) {
        if (runId !== gridRunId) return;
        const el = cellAt(r, c);
        if (!el.classList.contains("g-start") && !el.classList.contains("g-target"))
          el.className = "cell g-path";
        await sleep(16);
      }
      P.ptPath.textContent = path.length.toLocaleString();
      P.ptTime.textContent = elapsed.toFixed(1);
      P.ptMsg.textContent = `Shortest path found after exploring ${visitedCount.toLocaleString()} cells`;
      P.ptMsg.className = "stat-msg done";
    } else {
      P.ptTime.textContent = elapsed.toFixed(1);
      P.ptMsg.textContent = "No path — the target is walled off";
      P.ptMsg.className = "stat-msg";
    }
  }

  P.run.addEventListener("click", runBFS);
  P.stop.addEventListener("click", () => {
    gridRunId++;
    resetGridStats();
    paintStatic();
    P.run.disabled = false;
    P.ptMsg.textContent = "Search stopped";
    P.ptMsg.className = "stat-msg";
  });

  buildGrid();

  /* ============================================================
     COMPARE — identical arrays, both algorithms, counted & timed
     ============================================================ */
  const C = {
    size: $("#cmp-size"), trials: $("#cmp-trials"),
    run: $("#cmp-run"), out: $("#cmp-results"),
  };

  function bubbleCounted(a) {
    let comp = 0, writes = 0;
    const n = a.length;
    for (let pass = 0; pass < n - 1; pass++) {
      let swapped = false;
      for (let i = 0; i < n - 1 - pass; i++) {
        comp++;
        if (a[i] > a[i + 1]) { const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; writes += 2; swapped = true; }
      }
      if (!swapped) break;
    }
    return { comp, writes };
  }

  function mergeCounted(a) {
    let comp = 0, writes = 0;
    const tmp = new Array(a.length);
    const rec = (lo, hi) => {
      if (hi - lo < 1) return;
      const mid = (lo + hi) >> 1;
      rec(lo, mid);
      rec(mid + 1, hi);
      let li = lo, ri = mid + 1, k = lo;
      while (li <= mid && ri <= hi) {
        comp++;
        tmp[k++] = a[li] <= a[ri] ? a[li++] : a[ri++];
      }
      while (li <= mid) tmp[k++] = a[li++];
      while (ri <= hi) tmp[k++] = a[ri++];
      for (let i = lo; i <= hi; i++) { a[i] = tmp[i]; writes++; }
    };
    rec(0, a.length - 1);
    return { comp, writes };
  }

  const isSorted = (a) => { for (let i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return false; return true; };
  const median = (xs) => { const s = [...xs].sort((p, q) => p - q); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(Math.round(n));

  C.run.addEventListener("click", async () => {
    const size = Number(C.size.value);
    const trials = Number(C.trials.value);
    C.run.disabled = true;
    C.out.innerHTML = `<p class="muted">Running ${trials} trial${trials > 1 ? "s" : ""} at n = ${size}…</p>`;
    await sleep(30);

    const bubble = { comp: [], writes: [], ms: [] };
    const merge = { comp: [], writes: [], ms: [] };
    for (let t = 0; t < trials; t++) {
      const base = makeArray(size, "random");
      const b = base.slice(), m = base.slice();
      let t0 = performance.now();
      const bm = bubbleCounted(b);
      bubble.ms.push(performance.now() - t0);
      t0 = performance.now();
      const mm = mergeCounted(m);
      merge.ms.push(performance.now() - t0);
      bubble.comp.push(bm.comp); bubble.writes.push(bm.writes);
      merge.comp.push(mm.comp); merge.writes.push(mm.writes);
      if (!isSorted(b) || !isSorted(m)) {
        C.out.innerHTML = '<p class="muted">Sanity check failed — an algorithm left its array unsorted. See console.</p>';
        console.error("unsorted", { b: !isSorted(b), m: !isSorted(m) });
        C.run.disabled = false;
        return;
      }
      await sleep(0); // keep UI responsive between trials
    }

    const agg = (algo, k) => median(algo[k]);
    const maxComp = agg(bubble, "comp");
    const maxWrites = agg(bubble, "writes");
    const maxMs = Math.max(agg(bubble, "ms"), 0.001);

    const row = (label, bubbleVal, mergeVal, max, cls) => `
      <div class="cmp-col">
        <div class="cmp-col-title"><b class="cat">${label}</b><b class="cat" style="color:var(--muted)">bubble vs merge</b></div>
        <div class="cmp-track">
          <span class="cmp-track-label">Bubble</span>
          <div style="flex:1"><div class="cmp-fill ${cls}" style="width:${Math.min(100, (bubbleVal / max) * 100)}%"></div></div>
          <span class="cmp-fill-value">${fmt(bubbleVal)}</span>
        </div>
        <div class="cmp-track">
          <span class="cmp-track-label">Merge</span>
          <div style="flex:1"><div class="cmp-fill b2" style="width:${Math.min(100, (mergeVal / max) * 100)}%"></div></div>
          <span class="cmp-fill-value">${fmt(mergeVal)}</span>
        </div>
      </div>`;

    C.out.innerHTML = `
      <table class="cmp-table">
        <thead><tr><th>Metric (median of ${trials} trials)</th><th>Bubble Sort</th><th>Merge Sort</th><th>Ratio</th></tr></thead>
        <tbody>
          <tr><td>Comparisons</td><td class="mono">${fmt(agg(bubble, "comp")) || ""}</td><td class="mono">${fmt(agg(merge, "comp")) || ""}</td><td class="mono">${(agg(bubble, "comp") / agg(merge, "comp")).toFixed(1)}×</td></tr>
          <tr><td>Array writes</td><td class="mono">${fmt(agg(bubble, "writes"))}</td><td class="mono">${fmt(agg(merge, "writes"))}</td><td class="mono">${(agg(bubble, "writes") / agg(merge, "writes")).toFixed(1)}×</td></tr>
          <tr><td>Wall time (ms)</td><td class="mono">${agg(bubble, "ms").toFixed(2)}</td><td class="mono">${agg(merge, "ms").toFixed(2)}</td><td class="mono">${(agg(bubble, "ms") / agg(merge, "ms")).toFixed(1)}×</td></tr>
          <tr><td>Least memory moved</td><td class="mono">O(1) extra</td><td class="mono">O(n) extra</td><td class="mono">—</td></tr>
        </tbody>
      </table>
      <div class="cmp-bars">
        ${row("Comparisons", agg(bubble, "comp"), agg(merge, "comp"), maxComp, "warp")}
        ${row("Array writes", agg(bubble, "writes"), agg(merge, "writes"), maxWrites, "warp")}
        ${row("Wall time (ms)", agg(bubble, "ms"), agg(merge, "ms"), maxMs, "warp")}
      </div>
      <p class="muted">Both algorithms were given the <em>same</em> arrays (fresh copy of one master array each
      trial). Counting comparisons and writes rather than only timing removes the huge noise from JIT
      warmup and system load, so it is the fairer measure. Watch what happens if you double the size:
      the bubble numbers keep growing ~4× (quadratic), while the merge numbers grow barely over 2× (n·log n).</p>`;

    C.run.disabled = false;
  });
})();
