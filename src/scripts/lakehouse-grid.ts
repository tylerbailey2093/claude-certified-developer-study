// Animated "lakehouse" background: a slowly drifting navy grid with a sparse
// pipeline DAG on top. Lava packets travel along DAG edges and nodes pulse when
// a packet arrives.
//
// Built to be read over for hours:
//   - capped at ~30 fps, devicePixelRatio capped, no shadowBlur
//   - stops entirely when the tab is hidden
//   - one static frame under prefers-reduced-motion, Save-Data, or motion=off
//   - body[data-grid] = full | dim | off  (hubs full, reading pages dim, exam off)
//   - degrades itself (fewer packets, 20 fps, then static) if frames run slow
//   - the layout is seeded and the drift is derived from wall-clock time, so the
//     picture is continuous across page navigations instead of jumping.

type Mode = 'full' | 'dim' | 'off';
type Node = { c: number; r: number; pulse: number; out: number[] };
type Edge = { from: number; to: number; dx: number; dy: number; len: number };
type Packet = { edge: number; u: number; dur: number };
type Colors = { line: string; node: string; packet: string; alpha: number; dark: boolean };

declare global {
  interface Window {
    __grid?: { frames: number; state: string; packets: number };
  }
}

const SEED = 0x5eed1e;
const DRIFT_PX_PER_S = 4;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

function readPrefsMotion(): string {
  try {
    const raw = localStorage.getItem('ccdvf:v2:prefs');
    return raw ? (JSON.parse(raw).motion ?? 'auto') : 'auto';
  } catch {
    return 'auto';
  }
}

export function startGrid(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let S = 64; // cell size, CSS px
  let C = 0; // columns in the periodic tile
  let R = 0;
  let TW = 0; // tile width in px
  let nodes: Node[] = [];
  let edges: Edge[] = [];
  let packets: Packet[] = [];
  let colors: Colors;
  let raf = 0;
  let last = 0;
  let lastT = 0;
  let frameBudget = 33;
  let packetScale = 1;
  let slowFrames: number[] = [];
  let degradeLevel = 0;
  let sprite: HTMLCanvasElement | null = null;
  const stats = { frames: 0, state: 'init', packets: 0 };
  window.__grid = stats;

  const mode = (): Mode => {
    const m = document.body.dataset.grid as Mode | undefined;
    return m === 'dim' || m === 'off' ? m : 'full';
  };
  const animated = () =>
    !reduced.matches && !saveData && readPrefsMotion() !== 'off' && mode() !== 'off' && degradeLevel < 2;

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
    colors = {
      line: v('--grid-line', 'rgba(111,168,214,.07)'),
      node: v('--grid-node', 'rgba(160,196,216,.28)'),
      packet: v('--grid-packet', '#ff3621'),
      alpha: parseFloat(v('--grid-alpha', '1')) || 1,
      dark: document.documentElement.dataset.theme !== 'light',
    };
    // Pre-rendered glow sprite: cheaper than shadowBlur on every packet.
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = 32;
    const g = sprite.getContext('2d')!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, colors.packet);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = colors.dark ? 0.55 : 0.3;
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
  }

  function build() {
    W = window.innerWidth;
    H = window.innerHeight;
    const mobile = W < 940;
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : W > 2560 ? 1.5 : 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    S = Math.max(48, Math.min(88, Math.min(W, H) / 14));
    C = Math.ceil(W / S) + 4;
    R = Math.ceil(H / S) + 1;
    TW = C * S;
    frameBudget = mobile ? 42 : 33;

    const rng = mulberry32(SEED);
    const active: (number | undefined)[][] = Array.from({ length: R }, () => Array(C).fill(undefined));
    nodes = [];
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++)
        if (rng() < 0.12) {
          active[r][c] = nodes.length;
          nodes.push({ c, r, pulse: 0, out: [] });
        }
    edges = [];
    const addEdge = (from: number, to: number, dc: number, dr: number) => {
      const dx = dc * S;
      const dy = dr * S;
      nodes[from].out.push(edges.length);
      edges.push({ from, to, dx, dy, len: Math.hypot(dx, dy) });
    };
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (rng() < 0.7)
        for (let k = 1; k <= 4; k++) {
          const t = active[n.r][(n.c + k) % C];
          if (t !== undefined) {
            addEdge(i, t, k, 0);
            break;
          }
        }
      if (rng() < 0.35)
        for (let k = 1; k <= 3 && n.r + k < R; k++) {
          const t = active[n.r + k][n.c];
          if (t !== undefined) {
            addEdge(i, t, 0, k);
            break;
          }
        }
    }
    const want = Math.max(6, Math.min(40, Math.round(edges.length / 3)));
    const count = Math.max(2, Math.round(want * (mode() === 'dim' ? 0.34 : 1) * (mobile ? 0.5 : 1) * packetScale));
    packets = [];
    for (let i = 0; i < count && edges.length; i++) packets.push(spawn(rng, true));
    stats.packets = packets.length;
  }

  function spawn(rng: () => number = Math.random, randomU = false): Packet {
    const edge = Math.floor(rng() * edges.length);
    return { edge, u: randomU ? rng() : 0, dur: edges[edge].len / (55 + rng() * 55) };
  }

  const wrapX = (x: number) => ((((x + 3 * S) % TW) + TW) % TW) - 3 * S;

  function draw(now: number, dt: number, moving: boolean) {
    const drift = moving ? (now / 1000) * DRIFT_PX_PER_S : 0;
    const dimFactor = mode() === 'dim' ? 0.65 : 1;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, W, H);
    ctx!.globalAlpha = colors.alpha * dimFactor;

    // grid lines, half-speed parallax
    ctx!.strokeStyle = colors.line;
    ctx!.lineWidth = 1;
    ctx!.beginPath();
    const off = (drift * 0.5) % S;
    for (let x = -off; x < W + S; x += S) {
      ctx!.moveTo(Math.round(x) + 0.5, 0);
      ctx!.lineTo(Math.round(x) + 0.5, H);
    }
    for (let y = 0; y < H + S; y += S) {
      ctx!.moveTo(0, Math.round(y) + 0.5);
      ctx!.lineTo(W, Math.round(y) + 0.5);
    }
    ctx!.stroke();

    // DAG edges
    ctx!.strokeStyle = colors.node;
    ctx!.globalAlpha = colors.alpha * dimFactor * 0.55;
    ctx!.beginPath();
    for (const e of edges) {
      const a = nodes[e.from];
      const x = wrapX(a.c * S - drift);
      if (x > W + S || x + e.dx < -S) continue;
      const y = a.r * S;
      ctx!.moveTo(x, y);
      ctx!.lineTo(x + e.dx, y + e.dy);
    }
    ctx!.stroke();

    // nodes and pulses
    ctx!.globalAlpha = colors.alpha * dimFactor;
    ctx!.fillStyle = colors.node;
    for (const n of nodes) {
      const x = wrapX(n.c * S - drift);
      if (x < -S || x > W + S) continue;
      const y = n.r * S;
      ctx!.fillRect(x - 2, y - 2, 4, 4);
      if (n.pulse > 0.01) {
        ctx!.save();
        ctx!.globalAlpha = colors.alpha * dimFactor * 0.6 * n.pulse;
        ctx!.strokeStyle = colors.packet;
        ctx!.lineWidth = 1.2;
        ctx!.beginPath();
        ctx!.arc(x, y, 4 + 9 * (1 - n.pulse), 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.restore();
        n.pulse *= Math.exp(-dt / 650);
      }
    }

    // packets
    ctx!.fillStyle = colors.packet;
    for (const p of packets) {
      const e = edges[p.edge];
      if (!e) continue;
      if (moving) p.u += dt / 1000 / p.dur;
      if (p.u >= 1) {
        const to = nodes[e.to];
        to.pulse = 1;
        const next = to.out.length ? to.out[Math.floor(Math.random() * to.out.length)] : -1;
        Object.assign(p, next >= 0 ? { edge: next, u: 0, dur: edges[next].len / (55 + Math.random() * 55) } : spawn());
        continue;
      }
      const a = nodes[e.from];
      const x0 = wrapX(a.c * S - drift);
      const y0 = a.r * S;
      const k = ease(p.u);
      const x = x0 + e.dx * k;
      const y = y0 + e.dy * k;
      if (x < -20 || x > W + 20) continue;
      const horiz = e.dy === 0;
      if (sprite) {
        ctx!.save();
        ctx!.globalAlpha = colors.alpha * dimFactor;
        if (colors.dark) ctx!.globalCompositeOperation = 'lighter';
        ctx!.drawImage(sprite, x - 12, y - 12, 24, 24);
        ctx!.restore();
      }
      ctx!.globalAlpha = colors.alpha * dimFactor;
      for (let t = 1; t <= 3; t++) {
        const kt = ease(Math.max(0, p.u - t * 0.025));
        ctx!.globalAlpha = colors.alpha * dimFactor * (0.45 - t * 0.12);
        const tx = x0 + e.dx * kt;
        const ty = y0 + e.dy * kt;
        ctx!.fillRect(tx - 1.5, ty - 1.5, 3, 3);
      }
      ctx!.globalAlpha = colors.alpha * dimFactor;
      if (horiz) ctx!.fillRect(x - 4, y - 1.25, 8, 2.5);
      else ctx!.fillRect(x - 1.25, y - 4, 2.5, 8);
    }
    ctx!.globalAlpha = 1;
    stats.frames++;
  }

  function frame(t: number) {
    raf = requestAnimationFrame(frame);
    if (t - last < frameBudget) return;
    const dt = Math.min(100, last ? t - last : frameBudget);
    last = t;
    const t0 = performance.now();
    draw(Date.now(), dt, true);
    const cost = performance.now() - t0;
    slowFrames.push(cost);
    if (slowFrames.length >= 60) {
      const sorted = [...slowFrames].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      slowFrames = [];
      if (p95 > 20) degrade();
    }
    lastT = t;
  }

  function degrade() {
    degradeLevel++;
    if (degradeLevel === 1) {
      packetScale = 0.5;
      frameBudget = 50;
      build();
    } else {
      sync();
    }
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function sync() {
    stop();
    if (mode() === 'off') {
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      stats.state = 'off';
      return;
    }
    if (!animated() || document.hidden) {
      draw(Date.now(), 0, false);
      stats.state = document.hidden ? 'hidden' : 'static';
      return;
    }
    stats.state = 'running';
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  readColors();
  build();
  sync();

  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener?.('change', sync);
  window.addEventListener('ccdvf:store', sync);
  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      build();
      sync();
    }, 150);
  }).observe(document.documentElement);
  new MutationObserver(() => {
    readColors();
    sync();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  new MutationObserver(() => {
    build();
    sync();
  }).observe(document.body, { attributes: true, attributeFilter: ['data-grid'] });
  void lastT;
}

const el = document.getElementById('lakehouse-grid');
if (el instanceof HTMLCanvasElement) startGrid(el);
