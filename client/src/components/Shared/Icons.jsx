// Shinobi ink-brush icon set (24×24).
// Every mark is a *filled* shape: strokes are tapered brush sweeps (press → lift)
// generated below, and solid silhouettes get paper "knock-outs" (evenodd holes)
// instead of thin outlines. All fills use currentColor so icons inherit the text
// colour; nothing here relies on CSS variables (the 3D board rasterises some of
// these icons outside the document).

/* ─── Brush geometry (computed once at module load) ─── */

const r2 = (n) => Math.round(n * 100) / 100;
const pt = (p) => `${r2(p[0])} ${r2(p[1])}`;

/** Width profile of a brush sweep: lands at `start`, full at `peak`, lifts to `end` */
function widthAt(t, { start = 0.55, peak = 0.22, end = 0.25 }) {
  if (t < peak) return start + (1 - start) * (t / peak);
  const u = (t - peak) / (1 - peak);
  return 1 + (end - 1) * Math.pow(u, 1.6);
}

/** Tapered brush stroke along fn(t) → [x, y], t ∈ [0, 1], with round ends */
function brush(fn, w, opts = {}) {
  const n = opts.n || 18;
  const pts = Array.from({ length: n + 1 }, (_, i) => fn(i / n));
  const left = [];
  const right = [];
  const half = [];
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.max(i - 1, 0)];
    const b = pts[Math.min(i + 1, n)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const h = (w * widthAt(i / n, opts)) / 2;
    const [x, y] = pts[i];
    left.push([x + nx * h, y + ny * h]);
    right.push([x - nx * h, y - ny * h]);
    half.push(r2(h));
  }
  let d = `M${pt(left[0])}`;
  for (let i = 1; i <= n; i++) d += `L${pt(left[i])}`;
  d += `A${half[n]} ${half[n]} 0 0 0 ${pt(right[n])}`;
  for (let i = n - 1; i >= 0; i--) d += `L${pt(right[i])}`;
  d += `A${half[0]} ${half[0]} 0 0 0 ${pt(left[0])}Z`;
  return d;
}

const quadFn = (x0, y0, cx, cy, x1, y1) => (t) => {
  const u = 1 - t;
  return [u * u * x0 + 2 * t * u * cx + t * t * x1, u * u * y0 + 2 * t * u * cy + t * t * y1];
};

/** Straight-ish brush stroke; `bend` bows it sideways (in px) */
function line(x0, y0, x1, y1, w, opts = {}) {
  const { bend = 0 } = opts;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const cx = (x0 + x1) / 2 - ((y1 - y0) / len) * bend;
  const cy = (y0 + y1) / 2 + ((x1 - x0) / len) * bend;
  return brush(quadFn(x0, y0, cx, cy, x1, y1), w, opts);
}

const quad = (x0, y0, cx, cy, x1, y1, w, opts) => brush(quadFn(x0, y0, cx, cy, x1, y1), w, opts);

/** Arc stroke (ensō-like), angles in degrees */
const arc = (cx, cy, r, a0, a1, w, opts = {}) =>
  brush(
    (t) => {
      const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    },
    w,
    { n: 32, ...opts }
  );

/** Closed brushed ring (ellipse or squircle with exp > 2); thick where the brush pressed */
function ring(cx, cy, rx, ry, w, { vary = 0.45, phase = 210, exp = 2, n = 48 } = {}) {
  const outer = [];
  const inner = [];
  const ph = (phase * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const ce = Math.sign(c) * Math.pow(Math.abs(c), 2 / exp);
    const se = Math.sign(s) * Math.pow(Math.abs(s), 2 / exp);
    const h = (w / 2) * (1 - vary + vary * (0.5 + 0.5 * Math.cos(th - ph)));
    outer.push([cx + (rx + h) * ce, cy + (ry + h) * se]);
    inner.push([cx + (rx - h) * ce, cy + (ry - h) * se]);
  }
  inner.reverse();
  const loop = (ps) => `M${ps.map(pt).join('L')}Z`;
  return loop(outer) + loop(inner);
}

/** Pointed grain / leaf / blade daub centred on (cx, cy) */
function leaf(cx, cy, len, wid, deg) {
  const a = (deg * Math.PI) / 180;
  const ux = (Math.cos(a) * len) / 2;
  const uy = (Math.sin(a) * len) / 2;
  const nx = -Math.sin(a) * wid;
  const ny = Math.cos(a) * wid;
  const t1 = [cx + ux, cy + uy];
  const t2 = [cx - ux, cy - uy];
  return `M${pt(t1)}Q${pt([cx + nx, cy + ny])} ${pt(t2)}Q${pt([cx - nx, cy - ny])} ${pt(t1)}Z`;
}

const circ = (cx, cy, r) =>
  `M${r2(cx - r)} ${r2(cy)}A${r} ${r} 0 1 0 ${r2(cx + r)} ${r2(cy)}A${r} ${r} 0 1 0 ${r2(cx - r)} ${r2(cy)}Z`;

const poly = (...p) => {
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
  return `${d}Z`;
};

/** Kunai lying along +x from x = 0 to x = len: leaf blade, wrapped grip, pommel ring */
function kunai(len) {
  const L = len;
  const body =
    `M${L} 0Q${L - 2.6} -2.7 ${L - 6} -3.6L${L - 8} -1.5L4.6 -1.5L4.6 1.5L${L - 8} 1.5L${L - 6} 3.6Q${L - 2.6} 2.7 ${L} 0Z` +
    // paper knock-out down the blade spine
    line(L - 6.4, 0, L - 2, 0, 0.85, { start: 1, end: 0.3 });
  const ring = circ(2.6, 0, 2.6) + circ(2.6, 0, 1.15);
  return { body, ring };
}

/* ─── Rendering helpers ─── */

function Svg({ children, className = 'w-5 h-5', strokeWidth = 1.6, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

/** A filled ink shape; `eo` turns nested sub-paths into paper knock-outs */
function Ink({ d, o, eo, ...rest }) {
  return <path d={d} fill="currentColor" stroke="none" fillOpacity={o} fillRule={eo ? 'evenodd' : undefined} {...rest} />;
}

/* ─── Resources ─── */

const WOOD = {
  tiers:
    'M12 1.8C13.2 3.9 14.7 5.8 16.7 7.6C15.1 7.9 13.6 7.6 12 8.5C10.4 7.6 8.9 7.9 7.3 7.6C9.3 5.8 10.8 3.9 12 1.8Z' +
    'M12 6C13.7 8.5 15.7 10.6 18.6 12.4C16.3 12.7 14.2 12.3 12 13.4C9.8 12.3 7.7 12.7 5.4 12.4C8.3 10.6 10.3 8.5 12 6Z' +
    'M12 10.4C14 13.3 16.9 15.6 20.6 17.4C17.5 17.9 14.8 17.3 12 18.5C9.2 17.3 6.5 17.9 3.4 17.4C7.1 15.6 10 13.3 12 10.4Z',
  trunk: line(12, 17.4, 12.1, 22.4, 2.6, { start: 1, peak: 0.1, end: 0.75 }),
  ground: line(6.6, 22.2, 17.6, 21.8, 1.2, { bend: 0.4, start: 0.4, peak: 0.4, end: 0.2 }),
};

export function WoodIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={WOOD.tiers} />
      <Ink d={WOOD.trunk} />
      <Ink d={WOOD.ground} o="0.7" />
    </Svg>
  );
}

const BRICK =
  poly(3, 4.8, 11.1, 4.5, 11.3, 8.7, 3.1, 8.9) +
  poly(12.7, 4.5, 21, 4.8, 20.9, 8.8, 12.9, 8.6) +
  poly(3, 10.4, 6.3, 10.3, 6.5, 14.4, 3.1, 14.5) +
  poly(7.9, 10.2, 16.1, 10.4, 16, 14.5, 8, 14.3) +
  poly(17.6, 10.4, 21, 10.3, 21, 14.3, 17.7, 14.5) +
  poly(3.1, 16.1, 11.2, 15.8, 11.1, 19.9, 3, 19.6) +
  poly(12.8, 15.9, 20.9, 16.1, 21, 19.9, 12.7, 20.1);

export function BrickIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={BRICK} />
    </Svg>
  );
}

const SHEEP = {
  wool: [
    [5.9, 12.4, 3],
    [8.8, 9.7, 3.1],
    [12.4, 9.4, 3.1],
    [15.2, 11.6, 2.8],
    [13.6, 14.6, 2.9],
    [8.6, 14.7, 2.9],
    [11, 12.4, 3.4],
  ]
    .map(([x, y, r]) => circ(x, y, r))
    .join(''),
  head: leaf(19.7, 11.8, 6.6, 4.3, 68),
  ear: leaf(17.6, 9.2, 3.2, 1.6, -28),
  legs: line(8.2, 16.6, 7.7, 21, 2.1, { start: 1, end: 0.6 }) + line(13.4, 16.8, 13.9, 21, 2.1, { start: 1, end: 0.6 }),
};

export function SheepIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={SHEEP.wool} />
      <Ink d={SHEEP.head} />
      <Ink d={SHEEP.ear} />
      <Ink d={SHEEP.legs} />
    </Svg>
  );
}

const WHEAT = {
  stalk: line(12.4, 22.4, 12, 5, 1.7, { bend: -0.8, start: 1, peak: 0.1, end: 0.55 }),
  blade: line(12.2, 19.8, 6.8, 15.4, 1.6, { bend: -1.2, start: 1, peak: 0.1, end: 0.12 }),
  grains:
    leaf(12, 3.7, 4.8, 2.6, 90) +
    [7.6, 11, 14.4].map((y) => leaf(9.6, y, 5.4, 2.8, -125) + leaf(14.4, y, 5.4, 2.8, -55)).join(''),
};

export function WheatIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={WHEAT.stalk} />
      <Ink d={WHEAT.blade} />
      <Ink d={WHEAT.grains} />
    </Svg>
  );
}

const ORE = {
  back: 'M10.4 20.2 13 9.2l3.6-5.7 3.1 6.2 1.6 10.5Z',
  front: 'M2.8 20.4 5.7 11.6l4.2-3.7 3.2 4.7-1.6 7.8Z',
  facets: line(9.9, 8.4, 8.6, 19.6, 0.9, { start: 1, end: 0.4 }) + line(16.6, 4.4, 16.1, 19.6, 0.8, { start: 1, end: 0.3 }),
  ground: line(1.8, 21.1, 22.2, 20.7, 1.5, { bend: 0.3, start: 0.6, peak: 0.3, end: 0.35 }),
};

export function OreIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={ORE.back} o="0.72" />
      <Ink d={ORE.front + ORE.facets} eo />
      <Ink d={ORE.ground} />
    </Svg>
  );
}

export function ResourceIcon({ type, ...props }) {
  switch (type) {
    case 'wood':
      return <WoodIcon {...props} />;
    case 'brick':
      return <BrickIcon {...props} />;
    case 'sheep':
      return <SheepIcon {...props} />;
    case 'wheat':
      return <WheatIcon {...props} />;
    case 'ore':
      return <OreIcon {...props} />;
    default:
      return <AnchorIcon {...props} />;
  }
}

/* ─── Buildings & actions ─── */

/** Arched wooden bridge (roads, longest road, road-building card) */
const BRIDGE = {
  deck: quad(2.4, 15.2, 12, 8.4, 21.6, 15.2, 2.7, { start: 0.85, peak: 0.3, end: 0.8 }),
  rail: quad(3.6, 10.6, 12, 4.2, 20.4, 10.6, 1.5, { start: 0.7, peak: 0.3, end: 0.6 }),
  posts:
    line(6.4, 9, 6.4, 13.2, 1.6, { start: 1, end: 0.8 }) +
    line(12, 7.6, 12, 11.8, 1.6, { start: 1, end: 0.8 }) +
    line(17.6, 9, 17.6, 13.2, 1.6, { start: 1, end: 0.8 }),
  legs: line(4.4, 14, 4, 20.2, 2, { start: 1, end: 0.55 }) + line(19.6, 14, 20, 20.2, 2, { start: 1, end: 0.55 }),
  water: line(7.4, 19.8, 16.6, 19.6, 1.1, { bend: 0.5, start: 0.4, peak: 0.4, end: 0.2 }),
};

export function RoadIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={BRIDGE.deck} />
      <Ink d={BRIDGE.rail} />
      <Ink d={BRIDGE.posts} />
      <Ink d={BRIDGE.legs} />
      <Ink d={BRIDGE.water} o="0.65" />
    </Svg>
  );
}

const SETTLEMENT = {
  roof: 'M1.6 12.8C5 11.8 8.8 8.6 12 3.8C15.2 8.6 19 11.8 22.4 12.8C18.6 13.3 5.4 13.3 1.6 12.8Z',
  ridge: line(10.2, 4.6, 13.8, 4.6, 1.3, { start: 1, end: 0.5 }),
  walls: 'M5.4 12.6H18.6V20.8H14.1V15.8H9.9V20.8H5.4Z',
};

export function SettlementIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={SETTLEMENT.roof} />
      <Ink d={SETTLEMENT.ridge} />
      <Ink d={SETTLEMENT.walls} />
    </Svg>
  );
}

/** Three-tier pagoda keep */
const CITY = {
  finial: line(12, 0.9, 12, 4.6, 1.3, { start: 0.6, peak: 0.5, end: 1 }),
  tiers:
    'M6.6 8.1C9 7.4 10.8 6 12 3.9C13.2 6 15 7.4 17.4 8.1C14.6 8.5 9.4 8.5 6.6 8.1Z' +
    'M9 7.9H15V10.6H9Z' +
    'M3.8 13.1C7 12.4 9.4 11.2 10.4 9.9H13.6C14.6 11.2 17 12.4 20.2 13.1C16.4 13.5 7.6 13.5 3.8 13.1Z' +
    'M6.9 12.9H17.1V15.6H6.9Z' +
    'M1.6 18.2C5.2 17.4 7.8 16.3 9 15.1H15C16.2 16.3 18.8 17.4 22.4 18.2C17.8 18.6 6.2 18.6 1.6 18.2Z' +
    'M4.8 18H19.2V21.6H14.2V19.2H9.8V21.6H4.8Z',
};

export function CityIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={CITY.finial} />
      <Ink d={CITY.tiers} />
    </Svg>
  );
}

/** Two paper talismans (ofuda) fanned like a hand of cards */
const CARDS = {
  back: poly(3.4, 5.6, 12, 5.6, 12, 21, 3.4, 21),
  front:
    poly(10.2, 3, 19.6, 3, 19.6, 19.4, 10.2, 19.4) +
    line(16.4, 5.8, 16.4, 16.4, 1.9, { start: 1, peak: 0.12, end: 0.25 }) +
    line(13.2, 5.8, 13.2, 12.4, 1.9, { start: 1, peak: 0.12, end: 0.25 }),
};

export function CardsIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={CARDS.back} o="0.5" transform="rotate(-11 7.7 13.3)" />
      <Ink d={CARDS.front} eo transform="rotate(8 14.9 11.2)" />
    </Svg>
  );
}

/** Two kunai flying past each other: exchange */
const KUNAI_TRADE = kunai(20);

export function TradeIcon(props) {
  return (
    <Svg {...props}>
      <g transform="translate(1.6 7) rotate(-4)">
        <Ink d={KUNAI_TRADE.body} eo />
        <Ink d={KUNAI_TRADE.ring} eo />
      </g>
      <g transform="translate(22.4 17) rotate(176)">
        <Ink d={KUNAI_TRADE.body} eo />
        <Ink d={KUNAI_TRADE.ring} eo />
      </g>
    </Svg>
  );
}

const DICE = {
  frame: ring(12, 12, 7.9, 7.9, 2.5, { exp: 5, vary: 0.55, phase: 225 }),
  pips: circ(8.3, 8.3, 1.65) + circ(12, 12, 1.65) + circ(15.7, 15.7, 1.65),
};

export function DiceIcon(props) {
  return (
    <Svg {...props}>
      <g transform="rotate(-6 12 12)">
        <Ink d={DICE.frame} />
        <Ink d={DICE.pips} />
      </g>
    </Svg>
  );
}

/** Harbour: a sampan with a stern lantern on the waves */
const HARBOUR = {
  hull: 'M1.6 13.4C6 14.8 18 14.8 22.4 12.6C21 17 17.8 18.8 12 18.8C6.4 18.8 3.2 17.2 1.6 13.4Z',
  canopy: 'M5.8 14.1C6 10.6 8.2 9 10.8 9C13.4 9 15 10.6 15.2 14.1Z',
  pole: line(18, 14, 17.8, 9.4, 1.3, { start: 1, end: 1 }),
  lantern: 'M16 5.5C16 3.9 19.6 3.9 19.6 5.5V8.7C19.6 10.3 16 10.3 16 8.7Z',
  cap: line(16.4, 3.3, 19.2, 3.3, 1, { start: 1, end: 1 }),
  wave: brush((t) => [2.6 + 18.8 * t, 21.4 + 0.75 * Math.sin(t * 4 * Math.PI)], 1.5, { n: 28, start: 0.6, peak: 0.4, end: 0.3 }),
};

export function AnchorIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={HARBOUR.hull} />
      <Ink d={HARBOUR.canopy} o="0.8" />
      <Ink d={HARBOUR.pole} />
      <Ink d={HARBOUR.lantern} />
      <Ink d={HARBOUR.cap} />
      <Ink d={HARBOUR.wave} o="0.75" />
    </Svg>
  );
}

/** Makimono: hand-scroll with two rollers and vertical brush writing */
const MAKIMONO = {
  rollers:
    'M3.9 2.8H4.5C5.2 2.8 5.3 3.4 5.3 4.4H5.6C6 4.4 6.2 4.7 6.2 5.2V18.8C6.2 19.3 6 19.6 5.6 19.6H5.3C5.3 20.6 5.2 21.2 4.5 21.2H3.9C3.2 21.2 3.1 20.6 3.1 19.6H2.8C2.4 19.6 2.2 19.3 2.2 18.8V5.2C2.2 4.7 2.4 4.4 2.8 4.4H3.1C3.1 3.4 3.2 2.8 3.9 2.8Z' +
    'M19.5 2.8H20.1C20.8 2.8 20.9 3.4 20.9 4.4H21.2C21.6 4.4 21.8 4.7 21.8 5.2V18.8C21.8 19.3 21.6 19.6 21.2 19.6H20.9C20.9 20.6 20.8 21.2 20.1 21.2H19.5C18.8 21.2 18.7 20.6 18.7 19.6H18.4C18 19.6 17.8 19.3 17.8 18.8V5.2C17.8 4.7 18 4.4 18.4 4.4H18.7C18.7 3.4 18.8 2.8 19.5 2.8Z',
  paper: 'M6 6H18V18H6Z',
  edges: line(6, 6.1, 18, 5.9, 1.1, { start: 1, end: 0.7 }) + line(6, 18, 18, 18.1, 1.1, { start: 1, end: 0.7 }),
  writing:
    line(9, 8.4, 9.1, 15.6, 1.7, { start: 1, peak: 0.12, end: 0.25 }) +
    line(12, 8.4, 12, 13.4, 1.7, { start: 1, peak: 0.12, end: 0.25 }) +
    line(15, 8.4, 14.9, 14.8, 1.7, { start: 1, peak: 0.12, end: 0.25 }),
};

export function ScrollIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={MAKIMONO.paper} o="0.2" />
      <Ink d={MAKIMONO.edges} />
      <Ink d={MAKIMONO.writing} />
      <Ink d={MAKIMONO.rollers} />
    </Svg>
  );
}

/** Ink speech slip with brushed lines knocked out of it */
const CHAT =
  'M4.4 3.9C9 3.5 15 3.6 19.6 4C20.8 4.1 21.5 4.9 21.5 6.1L21.3 14.2C21.3 15.4 20.5 16.1 19.3 16.2L11.6 16.4L5.6 20.8L6.8 16.4H4.6C3.4 16.4 2.6 15.6 2.6 14.4L2.5 6.1C2.5 4.9 3.2 4 4.4 3.9Z' +
  line(6.3, 8.4, 17.6, 8.1, 1.8, { start: 1, peak: 0.1, end: 0.3 }) +
  line(6.3, 12, 13.6, 11.9, 1.8, { start: 1, peak: 0.1, end: 0.3 });

export function ChatIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={CHAT} eo />
    </Svg>
  );
}

/** Forehead protector: cloth band, tied tails and an engraved metal plate (host / winner) */
const HEADBAND = {
  cloth:
    'M0.8 9.8C2.4 9.4 3.8 9.4 5.2 9.7V15.7C3.8 16 2.4 16 0.8 15.6Z' +
    'M18.8 9.7C20.2 9.4 21.6 9.4 23.2 9.9V15.4C21.6 15.8 20.2 15.9 18.8 15.7Z',
  tails:
    line(21, 15.2, 23, 21.8, 1.9, { bend: -0.8, start: 1, peak: 0.1, end: 0.2 }) +
    line(19.6, 15.6, 19.9, 22.4, 1.7, { bend: 0.8, start: 1, peak: 0.1, end: 0.2 }),
  plate:
    'M6.4 6.6H17.6C18.7 6.6 19.4 7.3 19.4 8.4V17C19.4 18.1 18.7 18.8 17.6 18.8H6.4C5.3 18.8 4.6 18.1 4.6 17V8.4C4.6 7.3 5.3 6.6 6.4 6.6Z' +
    circ(7.3, 12.7, 1) +
    circ(16.7, 12.7, 1) +
    poly(12, 8.6, 14.3, 12.7, 12, 16.8, 9.7, 12.7),
};

export function CrownIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={HEADBAND.cloth} o="0.6" />
      <Ink d={HEADBAND.tails} o="0.6" />
      <Ink d={HEADBAND.plate} eo />
    </Svg>
  );
}

/** Two kunai crossed, points up (knights / largest army) */
const KUNAI_X = kunai(19.5);

export function SwordsIcon(props) {
  return (
    <Svg {...props}>
      {[-45, -135].map((a) => (
        <g key={a} transform={`translate(12 12.2) rotate(${a}) translate(-9.75 0)`}>
          <Ink d={KUNAI_X.body} eo />
          <Ink d={KUNAI_X.ring} eo />
        </g>
      ))}
    </Svg>
  );
}

/** Round victory seal hanging from two cords, star knocked out */
function starPath(cx, cy, ro, ri, pts = 5) {
  const p = [];
  for (let i = 0; i < pts * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / pts;
    const r = i % 2 ? ri : ro;
    p.push(r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a)));
  }
  return poly(...p);
}

const MEDAL = {
  cords:
    line(7.2, 1.8, 10.6, 9.8, 2, { start: 0.7, peak: 0.3, end: 1 }) + line(16.8, 1.8, 13.4, 9.8, 2, { start: 0.7, peak: 0.3, end: 1 }),
  seal: circ(12, 15.3, 6.5) + ring(12, 15.3, 5.1, 5.1, 0.7, { vary: 0.5 }) + starPath(12, 15.5, 3.3, 1.4),
};

export function MedalIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={MEDAL.cords} />
      <Ink d={MEDAL.seal} eo />
    </Svg>
  );
}

/** Stack of old round coins with square holes */
const COINS = {
  back: circ(9, 8.6, 5.6) + poly(7.7, 7.3, 10.3, 7.3, 10.3, 9.9, 7.7, 9.9),
  front: circ(14.6, 14.6, 6.2) + poly(13.2, 13.2, 16, 13.2, 16, 16, 13.2, 16) + ring(14.6, 14.6, 4.6, 4.6, 0.6, { vary: 0.5 }),
};

export function CoinsIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={COINS.back} o="0.55" eo />
      <Ink d={COINS.front} eo />
    </Svg>
  );
}

/** Wandering ronin: wide straw kasa over a cloak */
const RONIN = {
  hat:
    'M12 2.4C14.6 5.5 18 7.8 22.4 9C19.7 10.3 15.8 10.9 12 10.9C8.2 10.9 4.3 10.3 1.6 9C6 7.8 9.4 5.5 12 2.4Z' +
    line(11.6, 4.6, 7.6, 9.6, 0.7, { start: 1, end: 0.4 }) +
    line(12.4, 4.6, 16.4, 9.6, 0.7, { start: 1, end: 0.4 }),
  cloak: 'M7.4 11.4C6.2 14.7 5 18 4.4 21.8H19.6C19 18 17.8 14.7 16.6 11.4C15 11.7 13.5 11.8 12 11.8C10.5 11.8 9 11.7 7.4 11.4Z',
  fold: line(12, 14.2, 11.4, 21.2, 0.8, { start: 1, end: 0.3 }),
};

export function RobberIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={RONIN.hat} eo />
      <Ink d={RONIN.cloak + RONIN.fold} o="0.82" eo />
    </Svg>
  );
}

/** Masked shinobi head (knight card) */
const NINJA = {
  hood:
    'M12 2.6C17 2.6 19.9 6.4 19.9 11C19.9 15.2 17.6 18.2 14.6 19.4L16.2 22H7.8L9.4 19.4C6.4 18.2 4.1 15.2 4.1 11C4.1 6.4 7 2.6 12 2.6Z' +
    'M5.6 10.6Q12 7.4 18.4 10.2Q12 14 5.6 10.6Z' +
    leaf(9.4, 10.7, 2.8, 1.5, 12) +
    leaf(14.6, 10.6, 2.8, 1.5, -12) +
    line(7, 6.7, 17, 6.4, 1.1, { bend: -1, start: 0.8, peak: 0.4, end: 0.5 }),
  tails: line(18.8, 7.2, 22.6, 9.6, 1.7, { bend: -0.6, start: 1, peak: 0.1, end: 0.2 }) + line(18.9, 8.4, 21.8, 12.8, 1.5, { bend: 0.4, start: 1, peak: 0.1, end: 0.2 }),
};

export function NinjaIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={NINJA.hood} eo />
      <Ink d={NINJA.tails} />
    </Svg>
  );
}

/** Tawara rice bale tied with rope (bounty) */
const BALE = {
  body:
    'M7.8 6.2H16.2C19.2 6.2 21.4 8.9 21.4 12.1C21.4 15.3 19.2 18 16.2 18H7.8C4.8 18 2.6 15.3 2.6 12.1C2.6 8.9 4.8 6.2 7.8 6.2Z' +
    ring(6.3, 12.1, 2, 4.2, 0.95, { vary: 0.35 }) +
    line(11.4, 6.9, 11.5, 17.3, 1.3, { bend: 1, start: 1, peak: 0.5, end: 1 }) +
    line(16, 6.9, 16.1, 17.3, 1.3, { bend: 1, start: 1, peak: 0.5, end: 1 }),
  straw: line(3.4, 20.6, 20.6, 20.4, 1.2, { bend: 0.4, start: 0.4, peak: 0.4, end: 0.2 }),
  tuft: line(18.8, 6.4, 20.6, 3, 1, { start: 1, end: 0.2 }) + line(17.8, 6.2, 18.2, 2.4, 1, { start: 1, end: 0.2 }),
};

export function RiceBaleIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={BALE.body} eo />
      <Ink d={BALE.straw} o="0.6" />
      <Ink d={BALE.tuft} />
    </Svg>
  );
}

/** Summoning seal: an open ensō circle with a chakra spiral (monopoly) */
const SUMMON = {
  enso: arc(12, 12, 8.9, -48, 262, 2.4, { start: 0.75, peak: 0.25, end: 0.15 }),
  spiral: brush(
    (t) => {
      const a = t * 2.15 * Math.PI * 2 + 0.6;
      const r = 0.5 + 4.6 * t;
      return [12 + r * Math.cos(a), 12 + r * Math.sin(a)];
    },
    1.9,
    { n: 40, start: 0.5, peak: 0.6, end: 0.35 }
  ),
};

export function SummonSealIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={SUMMON.enso} />
      <Ink d={SUMMON.spiral} />
    </Svg>
  );
}

/** Peace talisman (ofuda) with a brushed ensō: «Pacto de paz» */
const PEACE = {
  // paper strip with a knocked-out ensō and a stroke below
  ofuda:
    'M7 1.8L17 1.8L17 22.2L7 22.2Z' +
    ring(12, 9, 3.1, 3.1, 1.5, { phase: 200 }) +
    line(10, 15.6, 14, 15.6, 1.1, { start: 0.9, end: 0.3 }) +
    line(12, 17.2, 12, 20.4, 1.1, { start: 0.9, end: 0.3 }),
  cord: line(4, 4.6, 20, 4.2, 1.2, { bend: -0.6, start: 0.6, peak: 0.4, end: 0.3 }),
};

export function PeaceSealIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={PEACE.ofuda} eo />
      <Ink d={PEACE.cord} o="0.85" />
    </Svg>
  );
}

export function DevCardIcon({ type, ...props }) {
  switch (type) {
    case 'knight':
      return <NinjaIcon {...props} />;
    case 'roadBuilding':
      return <RoadIcon {...props} />;
    case 'yearOfPlenty':
      return <RiceBaleIcon {...props} />;
    case 'monopoly':
      return <SummonSealIcon {...props} />;
    case 'victoryPoint':
      return <MedalIcon {...props} />;
    default:
      return <CardsIcon {...props} />;
  }
}

/* ─── UI glyphs ─── */

const CLOSE =
  line(5, 5.2, 19, 18.8, 2.9, { bend: 0.5, start: 0.6, peak: 0.2, end: 0.3 }) +
  line(18.8, 5, 5.2, 19, 2.9, { bend: -0.5, start: 0.6, peak: 0.2, end: 0.3 });

export function CloseIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={CLOSE} />
    </Svg>
  );
}

const CHECK =
  line(4.4, 12.6, 9.6, 18.2, 3, { start: 0.55, peak: 0.6, end: 0.9 }) +
  line(9.2, 18.2, 20.2, 5.4, 3, { bend: 0.8, start: 1, peak: 0.05, end: 0.15 });

export function CheckIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={CHECK} />
    </Svg>
  );
}

/** Two paper talismans, the front one inked with a seal mark */
const COPY = {
  back: poly(3.6, 2.8, 13.8, 2.8, 13.8, 16.4, 3.6, 16.4),
  front:
    poly(9.4, 7.6, 20.4, 7.6, 20.4, 21.4, 9.4, 21.4) +
    line(16.5, 10.2, 16.5, 19.2, 1.9, { start: 1, peak: 0.12, end: 0.25 }) +
    line(13.3, 10.2, 13.3, 15.6, 1.9, { start: 1, peak: 0.12, end: 0.25 }),
};

export function CopyIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={COPY.back} o="0.5" />
      <Ink d={COPY.front} eo />
    </Svg>
  );
}

/** Diamond warning seal with a brushed "!" */
const ALERT =
  'M12 1.8C12.5 1.8 12.9 2 13.3 2.4L21.6 10.7C22.3 11.4 22.3 12.6 21.6 13.3L13.3 21.6C12.6 22.3 11.4 22.3 10.7 21.6L2.4 13.3C1.7 12.6 1.7 11.4 2.4 10.7L10.7 2.4C11.1 2 11.5 1.8 12 1.8Z' +
  line(12, 6.6, 12, 13.6, 2.8, { start: 1, peak: 0.1, end: 0.4 }) +
  circ(12, 16.7, 1.4);

export function AlertIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={ALERT} eo />
    </Svg>
  );
}

/** Round seal with a brushed "i" */
const INFO = circ(12, 12, 9.8) + circ(12, 7.2, 1.45) + line(11.8, 10.2, 12.2, 17.4, 2.6, { bend: 0.3, start: 0.6, peak: 0.2, end: 0.8 });

export function InfoIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={INFO} eo />
    </Svg>
  );
}

/** Burning incense stick in a bowl: waiting / time */
const INCENSE = {
  bowl: 'M4.6 16.8H19.4C19 19.9 16.2 21.7 12 21.7C7.8 21.7 5 19.9 4.6 16.8Z',
  rim: line(3.4, 16.6, 20.6, 16.6, 1.5, { start: 0.8, peak: 0.3, end: 0.6 }),
  stick: line(12, 16.4, 12, 10.2, 1.4, { start: 1, end: 1 }),
  ember: circ(12, 9.4, 1.25),
  smoke: brush((t) => [12 + 1.6 * Math.sin(t * 2.3 * Math.PI) * (0.35 + t), 7.6 - t * 6.4], 1.5, { n: 24, start: 0.9, peak: 0.12, end: 0.15 }),
};

export function HourglassIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={INCENSE.bowl} />
      <Ink d={INCENSE.rim} />
      <Ink d={INCENSE.stick} />
      <Ink d={INCENSE.ember} />
      <Ink d={INCENSE.smoke} o="0.7" />
    </Svg>
  );
}

const ARROW =
  line(3, 12.7, 18.6, 11.9, 2.5, { bend: -0.6, start: 0.45, peak: 0.55, end: 0.8 }) +
  line(20.6, 11.9, 14.4, 6.2, 2.5, { bend: 0.5, start: 1, peak: 0.05, end: 0.25 }) +
  line(20.6, 12, 14.2, 17.7, 2.5, { bend: -0.5, start: 1, peak: 0.05, end: 0.25 });

export function ArrowRightIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={ARROW} />
    </Svg>
  );
}

/** Kunai pointing at the active player */
const KUNAI_MARK = kunai(21.6);

export function TurnMarkerIcon(props) {
  return (
    <Svg {...props}>
      <g transform="translate(1.2 12)">
        <Ink d={KUNAI_MARK.body} eo />
        <Ink d={KUNAI_MARK.ring} eo />
      </g>
    </Svg>
  );
}

/** Junk with a battened sail */
const JUNK = {
  hull: 'M2.2 15.4H21.8C21 18.6 18.6 20.4 15.6 20.4H8.4C5.4 20.4 3.2 18.6 2.2 15.4Z',
  mast: line(11.6, 15.6, 11.6, 2.4, 1.4, { start: 1, end: 0.7 }),
  sail:
    'M12.8 3.4C15.8 4.2 18.4 5.8 20 8.2L19.4 14.2H12.8Z' +
    line(13.2, 6.6, 19, 7.2, 0.7, { start: 1, end: 0.5 }) +
    line(13.2, 9.4, 19.4, 9.8, 0.7, { start: 1, end: 0.5 }) +
    line(13.2, 12, 19.3, 12.2, 0.7, { start: 1, end: 0.5 }),
  jib: 'M10.4 6L5 14.2H10.4Z',
  wave: brush((t) => [3.4 + 17.2 * t, 22.2 + 0.6 * Math.sin(t * 4 * Math.PI)], 1.2, { n: 24, start: 0.6, peak: 0.4, end: 0.3 }),
};

export function ShipIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={JUNK.hull} />
      <Ink d={JUNK.mast} />
      <Ink d={JUNK.sail} eo o="0.85" />
      <Ink d={JUNK.jib} o="0.5" />
      <Ink d={JUNK.wave} o="0.7" />
    </Svg>
  );
}

/* ─── Shinobi motifs (original drawings) ─── */

/** Four curved blades around a hub; `hole` is the colour of the centre hole */
const SHURIKEN_BLADE = 'M9.6 10.6C9.6 6.8 10.8 3.6 13.6 1.2C13 4.8 13.6 7.8 15.2 10.4Z';

export function ShurikenIcon({ hole = '#f1e9d6', ...props }) {
  return (
    <Svg {...props}>
      {[0, 90, 180, 270].map((a) => (
        <Ink key={a} d={SHURIKEN_BLADE} transform={`rotate(${a} 12 12)`} />
      ))}
      <Ink d={circ(12, 12, 3.4)} />
      <circle cx="12" cy="12" r="1.5" fill={hole} stroke="none" />
    </Svg>
  );
}

export function KunaiIcon(props) {
  return (
    <Svg {...props}>
      <g transform="translate(1.2 12)">
        <Ink d={KUNAI_MARK.body} eo />
        <Ink d={KUNAI_MARK.ring} eo />
      </g>
    </Svg>
  );
}

/** A leaf with a spiral drawn into it: our own village crest. */
export function LeafSwirlIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4.2 19.8C3.4 12.4 8 5.4 20.5 3.5c-.4 9.4-5.6 16-14 16.6" />
      <path d="M12.4 12.6c.8-.8 2.3-.4 2.4.8.2 1.7-1.7 3-3.4 2.4-2.3-.8-2.6-3.9-.8-5.6 2.2-2 5.8-1.2 6.8 1.4" />
      <path d="M4.2 19.8 2 22" />
    </Svg>
  );
}

/* ─── Board zoom & counters ─── */

const PLUS_H = line(4.4, 12.3, 19.6, 11.7, 3, { bend: -0.3, start: 0.85, peak: 0.25, end: 0.65 });
const PLUS_V = line(12.3, 4.4, 11.7, 19.6, 3, { bend: 0.3, start: 0.85, peak: 0.25, end: 0.65 });

export function ZoomInIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={PLUS_H} />
      <Ink d={PLUS_V} />
    </Svg>
  );
}

export function ZoomOutIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={PLUS_H} />
    </Svg>
  );
}

/** Brush "+" / "−" for the counter steppers */
export const PlusIcon = ZoomInIcon;
export const MinusIcon = ZoomOutIcon;

/** Four brushed frame corners */
const FIT_CORNER = quad(3.8, 10.2, 3.8, 3.8, 10.2, 3.8, 2.4, { start: 0.5, peak: 0.45, end: 0.3 });

export function FitIcon(props) {
  return (
    <Svg {...props}>
      {[0, 90, 180, 270].map((a) => (
        <Ink key={a} d={FIT_CORNER} transform={`rotate(${a} 12 12)`} />
      ))}
    </Svg>
  );
}

/** Brushed caret for dropdowns */
const CHEVRON =
  line(4.6, 8.4, 12.2, 16.4, 3.2, { start: 0.6, peak: 0.5, end: 1 }) +
  line(11.8, 16.4, 19.4, 8.4, 3.2, { start: 1, peak: 0.1, end: 0.3 });

export function ChevronDownIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={CHEVRON} />
    </Svg>
  );
}

/* ─── End game vote ─── */

/** Nobori war banner on an L-shaped pole */
const NOBORI = {
  pole: line(6, 22.4, 6, 2.2, 1.9, { start: 0.9, peak: 0.1, end: 0.85 }) + line(5.4, 3.2, 18.8, 3.2, 1.5, { start: 1, end: 0.6 }),
  banner:
    'M7.4 4.4H18.2V18.6L12.8 16.6L7.4 18.6Z' +
    ring(12.8, 9.6, 2.7, 2.7, 1.3, { vary: 0.5 }),
};

export function FlagIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={NOBORI.pole} />
      <Ink d={NOBORI.banner} eo />
    </Svg>
  );
}

/** Watching eye: two brushed lids around an inked pupil (spectators) */
const EYE = {
  lids:
    quad(2.4, 12.4, 12, 3.6, 21.6, 12.2, 2.2, { start: 0.5, peak: 0.45, end: 0.4 }) +
    quad(2.6, 12.6, 12, 20, 21.4, 12, 1.8, { start: 0.45, peak: 0.5, end: 0.35 }),
  pupil: circ(12, 12.2, 3.3) + circ(13.1, 11.1, 1),
};

export function EyeIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={EYE.lids} />
      <Ink d={EYE.pupil} eo />
    </Svg>
  );
}

/** Leaving: an open gate post and a brushed arrow going out */
const EXIT = {
  gate:
    line(10.4, 3.4, 4.2, 3.6, 2.1, { start: 0.9, peak: 0.2, end: 0.7 }) +
    line(4.4, 3.4, 4.4, 20.6, 2.3, { bend: 0.3, start: 0.9, peak: 0.15, end: 0.8 }) +
    line(4.2, 20.5, 10.4, 20.6, 2.1, { start: 0.8, peak: 0.3, end: 0.6 }),
  arrow:
    line(9.2, 12.2, 19.4, 12, 2.4, { bend: -0.4, start: 0.5, peak: 0.5, end: 0.8 }) +
    line(20.6, 12, 16, 7.6, 2.3, { bend: 0.4, start: 1, peak: 0.05, end: 0.25 }) +
    line(20.6, 12.1, 16, 16.5, 2.3, { bend: -0.4, start: 1, peak: 0.05, end: 0.25 }),
};

export function ExitIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={EXIT.gate} />
      <Ink d={EXIT.arrow} />
    </Svg>
  );
}

/** Three brush strokes (menu) */
const MENU =
  line(4, 6.4, 20, 6.2, 2.3, { bend: -0.3, start: 0.7, peak: 0.25, end: 0.45 }) +
  line(4, 12.1, 20, 12, 2.3, { bend: 0.3, start: 0.7, peak: 0.25, end: 0.45 }) +
  line(4, 17.8, 20, 17.7, 2.3, { bend: -0.3, start: 0.7, peak: 0.25, end: 0.45 });

export function MenuIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={MENU} />
    </Svg>
  );
}

/** Hanging calendar scroll: rod, sheet and a few brushed day marks */
const CALENDAR = {
  rod: line(3.4, 5.6, 20.6, 5.4, 2.2, { bend: -0.2, start: 0.6, peak: 0.3, end: 0.6 }),
  sheet: line(5.2, 6.4, 5.4, 20, 1.7, { bend: 0.2, start: 0.7, peak: 0.3, end: 0.5 }) +
    line(5.4, 20, 18.8, 19.8, 1.7, { bend: -0.2, start: 0.6, peak: 0.4, end: 0.6 }) +
    line(18.8, 19.8, 18.6, 6.4, 1.7, { bend: 0.2, start: 0.6, peak: 0.4, end: 0.7 }),
  rings: line(8.4, 3, 8.4, 7.4, 1.8, { start: 0.8, peak: 0.4, end: 0.8 }) +
    line(15.6, 3, 15.6, 7.4, 1.8, { start: 0.8, peak: 0.4, end: 0.8 }),
  days: line(8.3, 11, 10.1, 11, 1.9, { start: 0.9, peak: 0.5, end: 0.9 }) +
    line(13.9, 11, 15.7, 11, 1.9, { start: 0.9, peak: 0.5, end: 0.9 }) +
    line(8.3, 15.3, 10.1, 15.3, 1.9, { start: 0.9, peak: 0.5, end: 0.9 }),
};

export function CalendarIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={CALENDAR.rod} />
      <Ink d={CALENDAR.sheet} />
      <Ink d={CALENDAR.rings} />
      <Ink d={CALENDAR.days} o="0.85" />
      <Ink d={line(13.9, 15.3, 15.7, 15.3, 1.9, { start: 0.9, peak: 0.5, end: 0.9 })} o="0.85" fill="#c0271b" />
    </Svg>
  );
}

/** Brushed magnifying glass (search fields) */
const SEARCH = {
  lens: ring(10.2, 10.2, 6, 6, 2.1),
  handle: line(14.6, 14.6, 20.4, 20.4, 2.8, { start: 0.7, peak: 0.35, end: 0.55 }),
};

export function SearchIcon(props) {
  return (
    <Svg {...props}>
      <Ink d={SEARCH.lens} />
      <Ink d={SEARCH.handle} />
    </Svg>
  );
}
