// One illustrated scene per land tile, drawn in hex-local coordinates
// (pointy-top hex, radius HEX_SIZE = 60) and clipped to the tile by HexTile.
// The centre (r ≈ 24) is kept calm because the number seal / robber sit there.
// All motifs are original drawings inspired by a generic shinobi world.

const INK = '#1f1b17';

/* ─── Small reusable props ─── */

function Kunai({ x, y, rot = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0 0 L-5 -2.2 L-5 2.2 Z" fill="#c9d0d6" stroke={INK} strokeWidth="0.6" strokeLinejoin="round" />
      <rect x="-11" y="-0.9" width="6" height="1.8" fill="#2a2a30" />
      <circle cx="-12.6" cy="0" r="1.6" fill="none" stroke="#2a2a30" strokeWidth="0.9" />
    </g>
  );
}

function Shuriken({ x, y, s = 1, rot = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0 -6 L1.3 -1.3 L6 0 L1.3 1.3 L0 6 L-1.3 1.3 L-6 0 L-1.3 -1.3 Z" fill="#4a535e" stroke={INK} strokeWidth="0.5" strokeLinejoin="round" />
      <circle r="1" fill="#93a0ab" />
    </g>
  );
}

/** Wooden training post with rope bindings */
function TrainingPost({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0.8" cy="12" rx="6.5" ry="1.8" fill="#000" opacity="0.25" />
      <rect x="-4" y="-12" width="8" height="24" fill="#7a5131" stroke={INK} strokeWidth="0.9" />
      <rect x="1.2" y="-12" width="2.8" height="24" fill="#5e3c22" />
      <ellipse cx="0" cy="-12" rx="4" ry="1.6" fill="#a7774c" stroke={INK} strokeWidth="0.8" />
      <path d="M-1.6 -12 a1.6 0.6 0 1 0 3.2 0" stroke="#7a5131" strokeWidth="0.5" fill="none" />
      <path d="M-4 -3 H4 M-4 -1.4 H4 M-4 4 H4 M-4 5.6 H4" stroke="#e8dcc0" strokeWidth="0.9" />
    </g>
  );
}

function Sheep({ x, y, s = 1, flip = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx="0" cy="4.6" rx="6" ry="1.4" fill="#3f5a22" opacity="0.4" />
      <path d="M-2.8 3 v2.2 M2 3 v2.2" stroke={INK} strokeWidth="1" strokeLinecap="round" />
      <circle cx="-2.6" cy="0.5" r="2.8" fill="#f5f0e3" />
      <circle cx="0.8" cy="-0.8" r="3.1" fill="#f5f0e3" />
      <circle cx="2.4" cy="1.4" r="2.4" fill="#f5f0e3" />
      <circle cx="-0.6" cy="2" r="2.3" fill="#f5f0e3" />
      <path d="M-5.2 1.4 a2.8 2.8 0 0 1 1.6 -3.4 a3.1 3.1 0 0 1 5.8 -0.6 a2.4 2.4 0 0 1 2.2 3.6" stroke="#7d7564" strokeWidth="0.6" fill="none" />
      <ellipse cx="5.4" cy="-0.4" rx="1.6" ry="1.9" fill={INK} />
      <path d="M4.6 -2 l-1 -0.8" stroke={INK} strokeWidth="0.8" strokeLinecap="round" />
    </g>
  );
}

/** Curved roof of clay tiles over a small plastered wall */
function ClayRoof({ x, y, w = 34, s = 1 }) {
  const h = w * 0.36;
  const tiles = [];
  for (let tx = -w / 2 + 3; tx < w / 2 - 1; tx += 3.2) tiles.push(tx);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-w / 2 + 4} y={h * 0.15} width={w - 8} height={h * 0.95} fill="#efe4cc" stroke={INK} strokeWidth="0.9" />
      <rect x={-w / 2 + 6} y={h * 0.4} width={w * 0.18} height={h * 0.7} fill="#3a2a1d" />
      <path d={`M${w * 0.06} ${h * 0.45} h${w * 0.2} v${h * 0.32} h${-w * 0.2} Z`} fill="#c9b27f" stroke={INK} strokeWidth="0.6" />
      <path
        d={`M${-w / 2 - 3} ${h * 0.25} Q${-w / 4} ${h * 0.05} ${-w / 2 + 6} ${-h} H${w / 2 - 6} Q${w / 4} ${h * 0.05} ${w / 2 + 3} ${h * 0.25} Z`}
        fill="#a9492a"
        stroke={INK}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <g stroke="#6e2a14" strokeWidth="0.7">
        {tiles.map((tx) => (
          <path key={tx} d={`M${tx} ${-h + 1} L${tx * 1.12} ${h * 0.18}`} />
        ))}
      </g>
      <g fill="#c86a42" stroke={INK} strokeWidth="0.4">
        {tiles.map((tx) => (
          <circle key={tx} cx={tx * 1.12} cy={h * 0.24} r="1.1" />
        ))}
      </g>
      <rect x={-w / 2 + 5} y={-h - 2} width={w - 10} height="2.6" rx="1" fill="#6e2a14" stroke={INK} strokeWidth="0.7" />
    </g>
  );
}

/** Stone lantern (tōrō) */
function StoneLantern({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={INK} strokeWidth="0.8" strokeLinejoin="round">
      <ellipse cx="0.6" cy="13" rx="7" ry="1.6" fill="#000" opacity="0.25" stroke="none" />
      <rect x="-5" y="10" width="10" height="3" fill="#9c9488" />
      <rect x="-1.8" y="2" width="3.6" height="8" fill="#aaa294" />
      <rect x="-4.5" y="0" width="9" height="2.4" fill="#9c9488" />
      <rect x="-3.4" y="-6" width="6.8" height="6" fill="#aaa294" />
      <rect x="-1.8" y="-4.8" width="3.6" height="3.6" fill="#f6b75b" stroke="none" />
      <path d="M-7 -6 Q0 -8 0 -12 Q0 -8 7 -6 Z" fill="#8d8579" />
      <circle cx="0" cy="-12.6" r="1.2" fill="#8d8579" />
    </g>
  );
}

/** Small vermilion torii gate */
function Torii({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={INK} strokeWidth="0.8" strokeLinejoin="round">
      <ellipse cx="0" cy="12.5" rx="13" ry="1.6" fill="#000" opacity="0.2" stroke="none" />
      <rect x="-8.5" y="-6" width="2.6" height="18.5" fill="#c23a22" />
      <rect x="5.9" y="-6" width="2.6" height="18.5" fill="#c23a22" />
      <rect x="-11" y="-3.5" width="22" height="2.2" fill="#c23a22" />
      <path d="M-14 -9.5 Q0 -7 14 -9.5 L13 -6.2 Q0 -4.6 -13 -6.2 Z" fill="#1f1b17" />
      <rect x="-1" y="-6" width="2" height="2.6" fill="#c23a22" />
    </g>
  );
}

/** Straw scarecrow dressed like a ninja: conical hat, headband, scarf */
function Scarecrow({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} strokeLinejoin="round">
      <ellipse cx="0.6" cy="17" rx="6" ry="1.4" fill="#000" opacity="0.22" />
      <path d="M0 -4 V17" stroke="#6b4a2b" strokeWidth="1.6" />
      <path d="M-12 1 H12" stroke="#6b4a2b" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M-13 1 l-2 -1.6 M-13 1 l-2 1.4 M13 1 l2 -1.6 M13 1 l2 1.4" stroke="#d9b45a" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M-5 -1 L5 -1 L6.5 11 L-6.5 11 Z" fill="#2f3b52" stroke={INK} strokeWidth="0.8" />
      <path d="M-5.6 3 H5.8" stroke="#c23a22" strokeWidth="1.4" />
      <path d="M-6.5 11 l-1 2.6 M-3 11 l-0.4 2.8 M0 11 v3 M3 11 l0.4 2.8 M6.5 11 l1 2.6" stroke="#d9b45a" strokeWidth="0.9" strokeLinecap="round" />
      <circle cx="0" cy="-4.5" r="3.6" fill="#e2c477" stroke={INK} strokeWidth="0.8" />
      <rect x="-3.8" y="-6.4" width="7.6" height="1.6" fill="#59626c" stroke={INK} strokeWidth="0.4" />
      <path d="M-9 -6.2 L0 -12.4 L9 -6.2 Q0 -4.8 -9 -6.2 Z" fill="#c9a865" stroke={INK} strokeWidth="0.8" />
      <path d="M3.6 -1.6 q5 0.4 7 3.4" stroke="#c23a22" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Round sandstone dome house */
function Dome({ x, y, r = 10 }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={INK} strokeWidth="0.9" strokeLinejoin="round">
      <ellipse cx="1" cy={r * 0.62} rx={r * 1.15} ry={r * 0.22} fill="#000" opacity="0.18" stroke="none" />
      <path d={`M${-r} ${r * 0.6} V0 A${r} ${r} 0 0 1 ${r} 0 V${r * 0.6} Z`} fill="#d7b27a" />
      <path d={`M${r * 0.25} ${-r * 0.97} A${r} ${r} 0 0 1 ${r} 0 V${r * 0.6} H${r * 0.45} Z`} fill="#bf955c" stroke="none" />
      <path d={`M${-r} 0 H${r}`} stroke="#9a7444" strokeWidth="0.7" />
      <circle cx={-r * 0.38} cy={r * 0.22} r={r * 0.17} fill="#3a2a1d" stroke="none" />
      <circle cx={r * 0.38} cy={r * 0.22} r={r * 0.17} fill="#3a2a1d" stroke="none" />
      <path d={`M${-r * 0.2} ${r * 0.6} V${r * 0.08} H${r * 0.2} V${r * 0.6}`} fill="#3a2a1d" stroke="none" />
    </g>
  );
}

/** Large sand gourd with a cork and a rope sash */
function Gourd({ x, y, s = 1, rot = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} stroke={INK} strokeWidth="0.9" strokeLinejoin="round">
      <ellipse cx="1.4" cy="13.2" rx="9" ry="2" fill="#000" opacity="0.22" stroke="none" />
      <path d="M0 -15 C4 -15 5 -11 4 -8 C3.6 -6.6 3.2 -5.4 4.6 -4.4 C10 -1 11 7 7 11 C4 14 -4 14 -7 11 C-11 7 -10 -1 -4.6 -4.4 C-3.2 -5.4 -3.6 -6.6 -4 -8 C-5 -11 -4 -15 0 -15 Z" fill="#b98a55" />
      <path d="M2.6 -14 C5 -12 4.4 -8 3.6 -6.4 C6 -3 10.4 1 8 9 C7 11 4 13 1 13.2 C6 8 7 1 2.6 -4" fill="#9a6e3e" stroke="none" />
      <rect x="-1.8" y="-18" width="3.6" height="3.4" rx="0.6" fill="#5e3c22" />
      <path d="M-5.2 -4.6 Q0 -2.6 5.2 -4.6" stroke="#efe6d0" strokeWidth="1.3" fill="none" />
      <path d="M-4.4 -1.8 L-1 -9.6" stroke="#efe6d0" strokeWidth="1.1" />
      <path d="M-4 2 Q-1 0 2 2" stroke="#f3e2b8" strokeWidth="0.6" fill="none" opacity="0.7" />
    </g>
  );
}

/** Leaf-swirl crest carved into bark (our own motif) */
function CarvedCrest({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke="#d8b48a" strokeWidth="0.8" strokeLinecap="round">
      <path d="M-3.4 3.6 C-4 -1.6 -0.6 -5 5 -5.6 C4.6 -0.4 1.6 3.4 -2.8 3.8" />
      <path d="M0.8 -0.6 c0.5 -0.5 1.4 -0.2 1.3 0.6 c-0.1 1 -1.2 1.6 -2 1.1 c-1.2 -0.7 -1 -2.6 0.4 -3.1 c1.4 -0.5 2.8 0.2 3.1 1.4" />
    </g>
  );
}

function CanopyClump({ x, y, r, dark = '#24492b', mid = '#36703f', light = '#86b86a' }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={dark} />
      <circle cx={-r * 0.25} cy={-r * 0.2} r={r * 0.72} fill={mid} />
      <path d={`M${-r * 0.8} ${-r * 0.2} a${r * 0.72} ${r * 0.72} 0 0 1 ${r * 0.7} ${-r * 0.65}`} stroke={light} strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </g>
  );
}

/* ─── Scenes ─── */

function ForestScene() {
  return (
    <g>
      {/* Canopy roof across the top */}
      <CanopyClump x={-44} y={-26} r={16} />
      <CanopyClump x={-20} y={-44} r={19} />
      <CanopyClump x={10} y={-50} r={19} />
      <CanopyClump x={36} y={-36} r={17} />
      <CanopyClump x={56} y={-14} r={13} />

      {/* Two tall cedar trunks framing the clearing */}
      <g stroke={INK} strokeWidth="1">
        <path d="M-41 -22 C-40 0 -40 30 -43 62 H-29 C-31 30 -31 0 -32 -24 Z" fill="#70492b" />
        <path d="M30 -22 C31 2 31 30 29 62 H39 C38 30 38 2 37 -22 Z" fill="#70492b" />
      </g>
      <path d="M-35 -18 C-34.5 8 -34.5 32 -36 60 M-38.5 -10 V20 M33.5 -16 V58" stroke="#3a2416" strokeWidth="1" fill="none" />
      <path d="M-33.5 -16 C-33 10 -33 36 -34 60" stroke="#8a5d38" strokeWidth="1.4" fill="none" />
      <CarvedCrest x={-36} y={8} s={1.25} />

      {/* Side foliage on the trunks */}
      <CanopyClump x={-52} y={6} r={10} />
      <CanopyClump x={50} y={12} r={10} />

      {/* Undergrowth and a training post with a kunai in it */}
      <CanopyClump x={-16} y={56} r={11} dark="#1f3f26" mid="#2c5a33" />
      <CanopyClump x={12} y={58} r={10} dark="#1f3f26" mid="#2c5a33" />
      <TrainingPost x={17} y={37} s={0.9} />
      <Kunai x={16} y={33} rot={-160} s={1.1} />
      <Shuriken x={-20} y={34} s={0.9} rot={20} />
    </g>
  );
}

function HillsScene() {
  return (
    <g>
      {/* Clay terraces at the back */}
      <path d="M-60 -24 Q-30 -40 0 -40 Q30 -40 60 -26 V-70 H-60 Z" fill="#c4683c" stroke={INK} strokeWidth="0.9" />
      <path d="M-60 -36 Q-20 -52 20 -50 Q44 -48 60 -40" stroke="#8b3a1b" strokeWidth="0.9" fill="none" />
      <path d="M-50 -30 Q-20 -44 10 -44" stroke="#e8a274" strokeWidth="1" fill="none" strokeLinecap="round" />

      {/* Village rooftops */}
      <ClayRoof x={30} y={-24} w={30} />
      <ClayRoof x={-30} y={32} w={38} />

      {/* Stone wall */}
      <g stroke={INK} strokeWidth="0.7" fill="#9a8d7a">
        <rect x="6" y="40" width="10" height="6" rx="1.5" />
        <rect x="17" y="40" width="11" height="6" rx="1.5" fill="#8a7d6b" />
        <rect x="29" y="40" width="10" height="6" rx="1.5" />
        <rect x="11" y="34" width="11" height="6" rx="1.5" fill="#a89b86" />
        <rect x="23" y="34" width="11" height="6" rx="1.5" />
        <rect x="35" y="34" width="9" height="6" rx="1.5" fill="#8a7d6b" />
        <rect x="2" y="46" width="12" height="6" rx="1.5" fill="#8a7d6b" />
        <rect x="15" y="46" width="11" height="6" rx="1.5" />
      </g>
      <StoneLantern x={44} y={14} s={1} />
      <StoneLantern x={-46} y={-4} s={0.8} />
    </g>
  );
}

function PastureScene() {
  return (
    <g>
      {/* Training ground: three wooden posts */}
      <TrainingPost x={-30} y={-22} s={1.05} />
      <TrainingPost x={-6} y={-38} s={1.05} />
      <TrainingPost x={22} y={-30} s={1.05} />
      <path d="M-48 -6 q10 -3 20 0 M28 -10 q10 -3 20 0" stroke="#6a8a38" strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* Grazing sheep */}
      <Sheep x={-28} y={30} s={1.7} />
      <Sheep x={8} y={44} s={1.6} flip />
      <Sheep x={36} y={24} s={1.5} />

      <Shuriken x={-40} y={8} s={0.85} rot={12} />
      <Shuriken x={42} y={-4} s={0.75} rot={-8} />
      <g stroke="#5f7e30" strokeWidth="1" strokeLinecap="round">
        <path d="M-10 26 l1 -4 M-8 26 v-4.6 M-6 26 l-1 -4" />
        <path d="M24 46 l1 -4 M26 46 v-4.6 M28 46 l-1 -4" />
      </g>
    </g>
  );
}

function FieldsScene() {
  return (
    <g>
      {/* Paddy dike paths */}
      <path d="M-60 -6 L60 -28 M-60 30 L60 8" stroke="#efd9a0" strokeWidth="2.4" opacity="0.55" />
      <path d="M-60 -6 L60 -28 M-60 30 L60 8" stroke="#8f6418" strokeWidth="0.6" opacity="0.6" transform="translate(0 1.6)" />

      <Torii x={-6} y={-40} s={1.2} />
      <Scarecrow x={36} y={14} s={1.25} />

      {/* Sheaves of grain */}
      {[[-32, 38], [-10, 48], [-44, 12]].map(([sx, sy]) => (
        <g key={`${sx}`} transform={`translate(${sx} ${sy})`} stroke={INK} strokeWidth="0.6">
          <path d="M-4 6 L-1 -6 L1 -6 L4 6 Z" fill="#e2b552" />
          <path d="M-5 -6 Q0 -12 5 -6 Q0 -8 -5 -6 Z" fill="#c98f22" />
          <rect x="-2.6" y="-1" width="5.2" height="1.6" fill="#7a5131" stroke="none" />
        </g>
      ))}
    </g>
  );
}

function MountainsScene() {
  return (
    <g>
      {/* Cliff masses */}
      <path d="M-60 -10 L-44 -46 L-30 -38 L-18 -66 L4 -40 L-6 -24 L-24 -20 L-34 4 Z" fill="#4b545f" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      <path d="M-18 -66 L4 -40 L-6 -24 L-14 -40 Z" fill="#3a424c" />
      <path d="M8 -60 L30 -48 L46 -56 L60 -30 L56 10 L38 2 L30 -22 L14 -28 Z" fill="#535c68" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      <path d="M46 -56 L60 -30 L56 10 L46 -16 Z" fill="#3e4650" />

      {/* Rock hatching */}
      <g stroke={INK} strokeWidth="0.6" opacity="0.5">
        <path d="M-50 -22 l5 -8 M-44 -16 l4 -7 M-28 -44 l4 -8 M24 -40 l4 -7 M36 -30 l3 -6 M50 -20 l3 -6" />
      </g>

      {/* Ore veins with glints */}
      <g stroke="#cfe6f2" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M-46 -30 l6 4 l4 -5 l7 3" />
        <path d="M20 -44 l6 6 l6 -3 l5 6" />
      </g>
      <g fill="#e3f0f7" stroke={INK} strokeWidth="0.4">
        <path d="M-36 -30 l2 -3 l2 3 l-2 2 Z" />
        <path d="M32 -40 l2 -3.4 l2 3.4 l-2 2.2 Z" />
        <path d="M44 -6 l1.6 -2.8 l1.6 2.8 l-1.6 1.8 Z" />
      </g>

      {/* Ore crystals breaking out of the rock */}
      <g transform="translate(42 26)" stroke={INK} strokeWidth="0.7" strokeLinejoin="round">
        <path d="M-8 8 L-6 -2 L-3 -5 L-1 8 Z" fill="#9fb8c8" />
        <path d="M-2 8 L0 -10 L3 -12 L5 8 Z" fill="#c9dde8" />
        <path d="M4 8 L6 0 L9 -2 L10 8 Z" fill="#8aa3b4" />
        <path d="M0 -10 L1.6 6" stroke="#ffffff" strokeWidth="0.6" opacity="0.8" />
        <path d="M-11 8 H13" stroke={INK} strokeWidth="1" />
      </g>

      {/* Waterfall into a pool */}
      <path d="M-30 -36 C-31 -20 -31 -4 -30 14 H-22 C-23 -4 -23 -20 -22 -36 Z" fill="#cfe3ec" stroke={INK} strokeWidth="0.8" />
      <path d="M-28 -32 V12 M-25 -30 V10" stroke="#7fb0c8" strokeWidth="0.9" />
      <ellipse cx="-26" cy="17" rx="14" ry="5" fill="#2f6684" stroke={INK} strokeWidth="0.8" />
      <path d="M-34 16 q3 -2 6 0 M-22 18 q3 -2 6 0" stroke="#cfe3ec" strokeWidth="0.8" fill="none" />

      {/* Sealed cave with rope and paper talismans */}
      <path d="M2 60 V44 C2 30 34 30 34 44 V60 Z" fill="#5d6773" stroke={INK} strokeWidth="1" />
      <path d="M8 60 V46 C8 36 28 36 28 46 V60 Z" fill="#14161b" />
      <path d="M6 41 Q18 46 30 41" stroke="#d9c38a" strokeWidth="1.8" fill="none" />
      <g stroke={INK} strokeWidth="0.5">
        <rect x="11" y="43" width="4" height="9" fill="#f6efdf" />
        <rect x="21" y="43.6" width="4" height="9" fill="#f6efdf" />
      </g>
      <path d="M13 45 v5 M23 45.6 v5" stroke="#b6331f" strokeWidth="1" />
    </g>
  );
}

function DesertScene() {
  return (
    <g>
      {/* Sand village domes along the top */}
      <Dome x={-26} y={-34} r={11} />
      <Dome x={4} y={-46} r={13} />
      <Dome x={32} y={-28} r={10} />
      <path d="M-44 -24 H50" stroke="#a07d4a" strokeWidth="0.8" opacity="0.6" />

      {/* Big gourd resting in the sand */}
      <Gourd x={32} y={34} s={1.3} rot={-12} />

      {/* Wind-blown sand */}
      <g stroke="#a88a55" strokeWidth="1" fill="none" strokeLinecap="round">
        <path d="M-50 22 q8 -6 16 0 t16 0" />
        <path d="M-44 38 q6 -4 12 0 t12 0" />
        <path d="M-30 52 c4 -6 12 -6 12 0 c0 3 -4 4 -6 2" />
      </g>
    </g>
  );
}

const SCENES = {
  forest: ForestScene,
  hills: HillsScene,
  pasture: PastureScene,
  fields: FieldsScene,
  mountains: MountainsScene,
  desert: DesertScene,
};

/** Illustration for a tile, centred on (x, y). Caller clips it to the hex. */
export function TerrainArt({ terrain, x, y }) {
  const Scene = SCENES[terrain];
  if (!Scene) return null;
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <Scene />
    </g>
  );
}
