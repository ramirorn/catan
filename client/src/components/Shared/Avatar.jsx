import { memo } from 'react';
import { AVATAR_NAMES, SPECTATOR_RING, isAvatarId } from '../../utils/avatars';
import { pieceColor } from '../../utils/theme';

// ─── Profile avatars ───
// Twelve original ninja archetypes drawn as small ink-and-wash busts on a
// 64×64 grid. Bold silhouettes and one strong feature each (headband, mask,
// red eye, fan, gourd…) so they still read at 24 px; brushed ink outlines and
// the game palette give the detail at 96 px. The round frame (CSS) can take
// the player's colour as a ring.

const INK = '#1f1b17';
const SKIN = '#f0cca4';
const SKIN_TAN = '#d9a679';
const SKIN_PALE = '#f6e2cc';
const PAPER = '#f9f4e8';
const PAPER_DEEP = '#e4d8bd';
const STEEL = '#a9b2ba';
const STEEL_LIGHT = '#dfe4e8';
const STEEL_DARK = '#59626c';
const SHU = '#b6331f';
const SHU_LIGHT = '#d4492f';
const CHAKRA = '#e2711d';
const LEAF = '#4c7a3a';
const NIGHT = '#141c2c';

const line = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' };
const thin = { ...line, strokeWidth: 1.5 };

/* ─── Shared pieces ─── */

function Backdrop({ color }) {
  return (
    <>
      <rect width="64" height="64" fill={color} />
      {/* soft brushed halo behind the head */}
      <circle cx="32" cy="29" r="21" fill="#fff" opacity="0.12" />
    </>
  );
}

function Shoulders({ fill }) {
  return <path d="M4 67 C6 55 17 50.5 32 50.5 C47 50.5 58 55 60 67 Z" fill={fill} {...line} />;
}

function Neck({ skin = SKIN }) {
  return <path d="M27.5 44 L27.5 52.5 Q32 54.5 36.5 52.5 L36.5 44 Z" fill={skin} {...line} />;
}

function Head({ skin = SKIN, ears = true }) {
  return (
    <>
      {ears && (
        <>
          <ellipse cx="21" cy="36.5" rx="2.4" ry="3.2" fill={skin} {...thin} />
          <ellipse cx="43" cy="36.5" rx="2.4" ry="3.2" fill={skin} {...thin} />
        </>
      )}
      <ellipse cx="32" cy="35" rx="11" ry="12.5" fill={skin} {...line} />
    </>
  );
}

// Round eyes with a glint
function Eyes({ y = 37.4, rx = 1.65, ry = 2.25, color = INK, glint = true }) {
  return (
    <>
      <ellipse cx="27.6" cy={y} rx={rx} ry={ry} fill={color} />
      <ellipse cx="36.4" cy={y} rx={rx} ry={ry} fill={color} />
      {glint && (
        <>
          <circle cx="28.2" cy={y - 0.8} r="0.6" fill="#fff" />
          <circle cx="37" cy={y - 0.8} r="0.6" fill="#fff" />
        </>
      )}
    </>
  );
}

// Half-closed, unimpressed eye
function LidEye({ cx, y = 37 }) {
  return (
    <>
      <path d={`M${cx - 2.6} ${y} L${cx + 2.6} ${y}`} {...line} strokeWidth="1.7" />
      <path d={`M${cx - 2.1} ${y} Q${cx} ${y + 3.4} ${cx + 2.1} ${y} Z`} fill={INK} />
    </>
  );
}

// Forehead plate (generic engraved chevron, no village emblem)
function Plate({ x = 26, y = 21.8, w = 12, h = 6.4 }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="1.2" fill={STEEL_LIGHT} {...thin} />
      <path d={`M${cx - 3} ${cy + 1.2} L${cx} ${cy - 1.3} L${cx + 3} ${cy + 1.2}`} fill="none" stroke={STEEL_DARK} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/* ─── The twelve ninjas ─── */

// 0 · Ninja de la bandana: spiky gold hair, orange headband, big grin
function Bandana() {
  const hair = '#d6a238';
  return (
    <>
      <Backdrop color="#67717d" />
      <path d="M19 35 L13 27 L18.5 24.5 L14 15 L22.5 18 L23.5 7.5 L29.5 14.5 L34 5.5 L37 14.5 L44.5 8.5 L43.5 18 L51 15 L46 24.5 L51.5 27.5 L45 35 Z" fill={hair} {...line} />
      <path d="M43.5 25.5 C48 24.5 51.5 22.5 56 20 L55 27 C51.5 27.5 47.5 29 44 30.5 Z" fill={CHAKRA} {...thin} />
      <Shoulders fill={CHAKRA} />
      <path d="M22 51.2 Q32 58 42 51.2" fill="none" {...line} strokeWidth="2.4" />
      <path d="M32 57 L32 64" {...thin} />
      <Neck />
      <Head />
      <path d="M22.5 27 L24 33.5 L26.5 28.5 L29 33 L31.5 28.5 L33.5 33.5 L36 28.5 L38.5 33 L41.5 27 Z" fill={hair} {...thin} />
      <path d="M20.5 31 C26 26.5 38 26.5 43.5 31 L44 25.5 C38 20.5 26 20.5 20 25.5 Z" fill={CHAKRA} {...line} />
      <Plate />
      <Eyes />
      <path d="M26.8 41.4 Q32 47.6 37.2 41.4 Q32 43 26.8 41.4 Z" fill={PAPER} {...thin} />
    </>
  );
}

// 1 · Jōnin enmascarado: silver swept hair, cloth mask, plate over one eye
function Jonin() {
  return (
    <>
      <Backdrop color="#23506a" />
      <path d="M20 35 L13.5 31 L17 26.5 L8 20.5 L18 19 L12 10 L23 13 L24 4 L31 12 L38 5.5 L39.5 14 L47.5 12 L44.5 20.5 L47 28 L44 35 Z" fill={STEEL_LIGHT} {...line} />
      <Shoulders fill={LEAF} />
      <path d="M21 49.5 Q32 55.5 43 49.5 L44 54 Q32 60.5 20 54 Z" fill="#3a5f2c" {...line} />
      <Neck />
      <path d="M27.5 46 L27.5 52.5 Q32 54.5 36.5 52.5 L36.5 46 Z" fill="#26304a" {...line} />
      <Head />
      <path d="M21.2 38.5 Q32 41.8 42.8 38.5 C42.6 44 38 47.8 32 47.8 C26 47.8 21.4 44 21.2 38.5 Z" fill="#26304a" {...line} />
      <path d="M32 39.8 L33.3 42.6" stroke={STEEL_DARK} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20.5 34 L21.5 24 L25 29 L26.5 21.5 L30.5 27 L33 20.8 L35.5 26.5 L38.5 20.6 L40 25.5 L44.5 21.5 L44.8 26 L20 37.5 Z" fill={STEEL_LIGHT} {...thin} />
      <LidEye cx={36.6} y={36.4} />
      <path d="M19.5 37 L44.5 24 L45 30 L20 43.5 Z" fill="#26304a" {...line} />
      <g transform="rotate(-27.5 32 33.8)">
        <Plate x={26} y={30.6} w={12} h={6.2} />
      </g>
    </>
  );
}

// 2 · Sombra del ojo rojo: hooded cloak, high collar, one glowing red eye
function RedEye() {
  const cloak = '#221d19';
  return (
    <>
      <Backdrop color={PAPER_DEEP} />
      <circle cx="45" cy="18" r="10" fill={SHU} opacity="0.85" />
      <path d="M13.5 64 L13.5 34 C13.5 18 21.5 9.5 32 9.5 C42.5 9.5 50.5 18 50.5 34 L50.5 64 Z" fill={cloak} {...line} />
      <path d="M2 67 C4 53 12 46.5 20 44.5 L44 44.5 C52 46.5 60 53 62 67 Z" fill={cloak} {...line} />
      <Head skin={SKIN_PALE} ears={false} />
      <path d="M21 33 C21 22 27 19 33 19.5 C40 20 43.5 25 43 33 L40.5 28.5 L38.5 32.5 L36 27.5 L33 31.5 L31 27 L29 40 L26.5 31 L23.5 41 Z" fill={cloak} {...thin} />
      <circle cx="36.6" cy="36.8" r="4.2" fill={SHU_LIGHT} opacity="0.3" />
      <path d="M33.4 36.9 Q36.6 34.3 39.8 36.9 Q36.6 39.1 33.4 36.9 Z" fill={SHU_LIGHT} {...thin} strokeWidth="1.3" />
      <circle cx="36.6" cy="36.8" r="0.95" fill={INK} />
      <path d="M19.5 44.5 L21.5 40 Q32 45.5 42.5 40 L44.5 44.5 L44.5 52.5 Q32 57 19.5 52.5 Z" fill={cloak} {...line} />
      <path d="M18 30 C18.5 19 24.5 13 32 13 C39.5 13 45.5 19 46 30" fill="none" stroke={STEEL_DARK} strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
    </>
  );
}

// 3 · Kunoichi médica: pink bob, red hairband, white coat with a herb badge
function Medic() {
  const hair = '#ee9fb3';
  return (
    <>
      <Backdrop color="#8cae58" />
      <path d="M18 47 C14.5 32 18 19.5 32 19 C46 19.5 49.5 32 46 47 L40.5 47 L41.5 36 L22.5 36 L23.5 47 Z" fill={hair} {...line} />
      <Shoulders fill={PAPER} />
      <path d="M26 51 L32 57.5 L38 51" fill="none" {...thin} />
      <rect x="42" y="55.5" width="7" height="7" rx="1.4" fill={LEAF} {...thin} />
      <path d="M45.5 57.2 L45.5 60.8 M43.7 59 L47.3 59" stroke={PAPER} strokeWidth="1.5" strokeLinecap="round" />
      <Neck />
      <Head />
      <path d="M21 33 C21 24.5 26 21 32 21 C39 21 43 25 43 32.5 C40 27.5 36.5 26 33.5 25.8 L31.5 30.5 L29.5 26.3 C26 27.3 23 29.5 21 33 Z" fill={hair} {...thin} />
      <path d="M20.4 27.5 C23.5 19 40.5 19 43.6 27.5 L41.8 29.4 C39 23.2 25 23.2 22.2 29.4 Z" fill={SHU} {...thin} />
      <ellipse cx="25.2" cy="41" rx="2.2" ry="1.3" fill={SHU} opacity="0.25" />
      <ellipse cx="38.8" cy="41" rx="2.2" ry="1.3" fill={SHU} opacity="0.25" />
      <circle cx="27.6" cy="37.2" r="2.1" fill={LEAF} {...thin} strokeWidth="1.2" />
      <circle cx="36.4" cy="37.2" r="2.1" fill={LEAF} {...thin} strokeWidth="1.2" />
      <circle cx="27.6" cy="37.4" r="0.95" fill={INK} />
      <circle cx="36.4" cy="37.4" r="0.95" fill={INK} />
      <circle cx="28.3" cy="36.4" r="0.55" fill="#fff" />
      <circle cx="37.1" cy="36.4" r="0.55" fill="#fff" />
      <path d="M29.2 42.6 Q32 44.8 34.8 42.6" fill="none" {...thin} />
    </>
  );
}

// 4 · Ermitaño del sapo: wild white mane, toad hat, white beard
function ToadSage() {
  return (
    <>
      <Backdrop color="#d4492f" />
      <path d="M14 53 L7.5 45 L12.5 41 L5.5 33 L12.5 29.5 L7.5 20.5 L16.5 21.5 L15 12.5 L23 16.5 L32 11 L41 16.5 L49 12.5 L47.5 21.5 L56.5 20.5 L51.5 29.5 L58.5 33 L51.5 41 L56.5 45 L50 53 Z" fill={PAPER} {...line} />
      <Shoulders fill={LEAF} />
      <path d="M25 50.5 L32 61 L39 50.5" fill="none" stroke={PAPER} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M25 50.5 L32 61 L39 50.5" fill="none" {...thin} strokeWidth="1" />
      <Neck skin={SKIN_TAN} />
      <Head skin={SKIN_TAN} />
      <path d="M22.5 41.5 C23.5 50.5 28 55 32 56 C36 55 40.5 50.5 41.5 41.5 C38.5 44.5 35 45.3 32 45.3 C29 45.3 25.5 44.5 22.5 41.5 Z" fill={PAPER} {...line} />
      <path d="M27 41.6 Q32 39.3 37 41.6 Q32 43.1 27 41.6 Z" fill={PAPER} {...thin} />
      <path d="M25.6 37 Q27.7 35.2 29.8 37" fill="none" {...line} strokeWidth="1.7" />
      <path d="M34.2 37 Q36.3 35.2 38.4 37" fill="none" {...line} strokeWidth="1.7" />
      <path d="M23 31.6 Q26.5 29.4 30.4 30.6 L30 32.6 Q26.5 31.8 23.6 33.6 Z" fill={PAPER} {...thin} strokeWidth="1.1" />
      <path d="M41 31.6 Q37.5 29.4 33.6 30.6 L34 32.6 Q37.5 31.8 40.4 33.6 Z" fill={PAPER} {...thin} strokeWidth="1.1" />
      <path d="M19.5 29 C19.5 18 25.5 13.5 32 13.5 C38.5 13.5 44.5 18 44.5 29 Q32 25 19.5 29 Z" fill="#8cae58" {...line} />
      <path d="M22.5 26.4 Q32 23 41.5 26.4" fill="none" {...thin} strokeWidth="1.2" />
      <circle cx="25.5" cy="16" r="3.8" fill="#d6a238" {...thin} />
      <circle cx="38.5" cy="16" r="3.8" fill="#d6a238" {...thin} />
      <ellipse cx="25.5" cy="16" rx="1.9" ry="0.9" fill={INK} />
      <ellipse cx="38.5" cy="16" rx="1.9" ry="0.9" fill={INK} />
    </>
  );
}

const FAN_RIBS = Array.from({ length: 9 }, (_, i) => {
  const a = Math.PI + (i * Math.PI) / 8;
  return `M32 40 L${(32 + 27 * Math.cos(a)).toFixed(1)} ${(40 + 27 * Math.sin(a)).toFixed(1)}`;
}).join(' ');

// 5 · Kunoichi del viento: giant folding fan behind her, sandy tufts
function WindFan() {
  const hair = '#d6a238';
  return (
    <>
      <Backdrop color={STEEL_LIGHT} />
      <path d="M5 40 A27 27 0 0 1 59 40 Z" fill={PAPER} {...line} />
      <path d="M5 40 A27 27 0 0 1 12.9 20.9 L32 40 Z M51.1 20.9 A27 27 0 0 1 59 40 L32 40 Z M22 15 A27 27 0 0 1 42 15 L32 40 Z" fill="#23506a" opacity="0.85" />
      <path d={FAN_RIBS} stroke={INK} strokeWidth="1.1" />
      <path d="M5 40 A27 27 0 0 1 59 40" fill="none" {...line} />
      <circle cx="46.5" cy="24" r="3.2" fill={SHU} />
      <path d="M2 50 Q8 46 13 49 M51 49 Q56 46 62 50" fill="none" stroke={PAPER} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M21 40 C19 28 22.5 21 32 20.5 C41.5 21 45 28 43 40 Z" fill={hair} {...line} />
      <path d="M22.5 26 L14 20 L17 26.5 L12 29 L21 30.5 Z" fill={hair} {...thin} />
      <path d="M41.5 26 L50 20 L47 26.5 L52 29 L43 30.5 Z" fill={hair} {...thin} />
      <Shoulders fill="#24314b" />
      <path d="M25.5 50.8 L32 58.5 L38.5 50.8" fill="none" stroke={PAPER} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M8.5 60 Q32 66 55.5 60" fill="none" stroke={SHU} strokeWidth="3" />
      <Neck />
      <Head />
      <path d="M21 33 C21 25 26 21.5 32 21.5 C38 21.5 43 25 43 32.5 L39.5 27.5 L37.5 31.5 L34.5 26.5 L31.5 31 L28.5 26.5 L25.5 31.5 Z" fill={hair} {...thin} />
      <path d="M25.4 34.3 L30 35" {...thin} strokeWidth="1.4" />
      <path d="M38.6 34.3 L34 35" {...thin} strokeWidth="1.4" />
      <Eyes color="#23506a" />
      <path d="M28.8 42.6 Q32.5 44.4 35.6 41.8" fill="none" {...thin} />
    </>
  );
}

// 6 · Ninja de la arena: desert hood and face wrap, big clay gourd
function SandGourd() {
  const clay = '#b2532d';
  const wrap = PAPER_DEEP;
  return (
    <>
      <Backdrop color="#d6a238" />
      <circle cx="46" cy="27" r="7.5" fill={clay} {...line} />
      <circle cx="48" cy="46" r="13" fill={clay} {...line} />
      <path d="M40 34.5 Q46 37 52 34.5" fill="none" stroke="#861f11" strokeWidth="1.6" />
      <rect x="43" y="16.5" width="6" height="4.5" rx="1" fill="#857a6b" {...thin} />
      <path d="M38 41 Q44 37 50 40" fill="none" stroke={PAPER} strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round" />
      <Shoulders fill={STEEL_DARK} />
      <path d="M10 60 L47 40 L50 44.5 L14 64 Z" fill="#4b443c" {...thin} />
      <path d="M17 45 C15 28 22 17 32 17 C42 17 49 28 47 45 Z" fill={wrap} {...line} />
      <Neck />
      <Head ears={false} />
      <path d="M24 29.5 L26 33.5 L28 29 L30.5 33 L32.5 28.5 L34.5 32.8 L36.5 28.8 L39 33 L40.5 30 Q32 25.5 24 29.5 Z" fill="#a94f0c" {...thin} />
      <path d="M20 32.5 C20 23 26 19.5 32 19.5 C38 19.5 44 23 44 32.5 C40 27.5 36 26.5 32 26.5 C28 26.5 24 27.5 20 32.5 Z" fill={wrap} {...line} />
      <ellipse cx="27.6" cy="36.6" rx="2.5" ry="1.9" fill={PAPER} stroke={INK} strokeWidth="1.8" />
      <ellipse cx="36.4" cy="36.6" rx="2.5" ry="1.9" fill={PAPER} stroke={INK} strokeWidth="1.8" />
      <circle cx="27.8" cy="36.6" r="1.1" fill="#23506a" />
      <circle cx="36.6" cy="36.6" r="1.1" fill="#23506a" />
      <path d="M24.8 33.4 L30 34.2 M39.2 33.4 L34 34.2" {...thin} strokeWidth="1.3" />
      <path d="M21.3 39.5 Q32 43 42.7 39.5 C42.2 45 37.5 48.4 32 48.4 C26.5 48.4 21.8 45 21.3 39.5 Z" fill={wrap} {...line} />
      <path d="M24 43 Q32 45.8 40 43 M26.5 46.4 Q32 48 37.5 46.4" fill="none" stroke="#b9a681" strokeWidth="1.1" strokeLinecap="round" />
    </>
  );
}

// 7 · Estratega perezoso: spiky top-knot, bored eyes, shogi piece
function LazyStrategist() {
  const hair = '#2b2622';
  return (
    <>
      <Backdrop color="#f6a04b" />
      <path d="M26.5 22 L21.5 9.5 L27.5 13.5 L29.5 4.5 L32.8 12.5 L37 5.5 L37.5 13.5 L43.5 10 L39.5 22 Z" fill={hair} {...line} />
      <rect x="28.3" y="18.5" width="7.6" height="3.6" rx="1" fill={STEEL_DARK} {...thin} />
      <Shoulders fill="#67717d" />
      <path d="M23 50.8 Q32 56 41 50.8" fill="none" stroke={INK} strokeWidth="1" strokeDasharray="1.4 1.4" />
      <Neck />
      <Head />
      <circle cx="21" cy="40.6" r="1.2" fill={STEEL_LIGHT} {...thin} strokeWidth="0.9" />
      <circle cx="43" cy="40.6" r="1.2" fill={STEEL_LIGHT} {...thin} strokeWidth="0.9" />
      <path d="M20.6 33.5 C20.2 24.5 25 20 32 20 C39 20 43.8 24.5 43.4 33.5 C41 28.5 37 26 32 26 C27 26 23 28.5 20.6 33.5 Z" fill={hair} {...line} />
      <path d="M24.6 33.6 L30 33.6 M34 33.6 L39.4 33.6" {...thin} strokeWidth="1.4" />
      <LidEye cx={27.6} y={36.8} />
      <LidEye cx={36.4} y={36.8} />
      <path d="M29.4 43 L34.6 42.5" {...thin} />
      <path d="M46.5 16 L51 16 L46.5 20.5 L51 20.5" fill="none" {...thin} />
      <path d="M9.5 29 L9.5 21 L14 17.5 L18.5 21 L18.5 29 Z" fill={PAPER} {...thin} />
      <path d="M12 22.6 L16 22.6 M14 22.6 L14 27 M12 27 L16 27" stroke={SHU} strokeWidth="1.2" strokeLinecap="round" />
    </>
  );
}

// 8 · Ninja de los insectos: round shades, collar up to the nose, beetles
function BugUser() {
  const hair = '#2b2622';
  const coat = STEEL;
  return (
    <>
      <Backdrop color="#4c7a3a" />
      <path d="M20 33 L17.5 22.5 L22 24 L21 15.5 L26 19 L28 11.5 L32 17 L36 11.5 L38 19 L43 15.5 L42 24 L46.5 22.5 L44 33 Z" fill={hair} {...line} />
      <Shoulders fill={STEEL_DARK} />
      <Head ears={false} />
      <circle cx="27.2" cy="35.2" r="4" fill={NIGHT} {...thin} />
      <circle cx="36.8" cy="35.2" r="4" fill={NIGHT} {...thin} />
      <path d="M31.2 34.6 L32.8 34.6" {...thin} />
      <path d="M24.8 33.8 Q26 32 27.8 32" fill="none" stroke={STEEL_LIGHT} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M34.4 33.8 Q35.6 32 37.4 32" fill="none" stroke={STEEL_LIGHT} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M15.5 66 L16.5 39 C20 41.5 25 42.5 32 42.5 C39 42.5 44 41.5 47.5 39 L48.5 66 Z" fill={coat} {...line} />
      <path d="M32 42.5 L32 66 M22 44 L22.5 60 M42 44 L41.5 60" stroke={STEEL_DARK} strokeWidth="1.2" strokeLinecap="round" />
      <g fill={INK}>
        <ellipse cx="50" cy="15" rx="1.6" ry="2" />
        <ellipse cx="55" cy="25" rx="1.4" ry="1.8" />
        <ellipse cx="12" cy="20" rx="1.3" ry="1.7" />
      </g>
      <g fill={PAPER} opacity="0.75">
        <ellipse cx="48.4" cy="13.6" rx="1.6" ry="0.8" />
        <ellipse cx="51.6" cy="13.6" rx="1.6" ry="0.8" />
        <ellipse cx="53.6" cy="23.8" rx="1.4" ry="0.7" />
        <ellipse cx="56.4" cy="23.8" rx="1.4" ry="0.7" />
        <ellipse cx="10.8" cy="18.8" rx="1.3" ry="0.65" />
        <ellipse cx="13.2" cy="18.8" rx="1.3" ry="0.65" />
      </g>
    </>
  );
}

// 9 · Kunoichi de mirada pálida: long indigo hair, pale eyes, headband at the neck
function PaleEyes() {
  const hair = '#2a3352';
  return (
    <>
      <Backdrop color="#b9a681" />
      <path d="M17 60 C14.5 41 15.5 21.5 32 19.5 C48.5 21.5 49.5 41 47 60 L40 60 L42 40 L22 40 L24 60 Z" fill={hair} {...line} />
      <Shoulders fill={PAPER} />
      <path d="M22 51 Q32 56 42 51" fill="none" stroke={STEEL_DARK} strokeWidth="1.4" />
      <Neck />
      <path d="M27 48.5 L37 48.5 L37 53.2 L27 53.2 Z" fill={NIGHT} {...thin} />
      <Plate x={28.2} y={48.2} w={7.6} h={5.2} />
      <Head />
      <path d="M20.3 31 L20.5 47.5 L24.2 47.5 L23.8 31 Z" fill={hair} {...thin} />
      <path d="M43.7 31 L43.5 47.5 L39.8 47.5 L40.2 31 Z" fill={hair} {...thin} />
      <path d="M21 32.5 C21 24 25 20.5 32 20.5 C39 20.5 43 24 43 32.5 Z" fill={hair} {...thin} />
      <ellipse cx="27.6" cy="37" rx="2.5" ry="2.15" fill="#ece6f2" stroke={INK} strokeWidth="1.4" />
      <ellipse cx="36.4" cy="37" rx="2.5" ry="2.15" fill="#ece6f2" stroke={INK} strokeWidth="1.4" />
      <circle cx="27.6" cy="37.1" r="1.1" fill="none" stroke="#9d90b8" strokeWidth="0.8" />
      <circle cx="36.4" cy="37.1" r="1.1" fill="none" stroke="#9d90b8" strokeWidth="0.8" />
      <ellipse cx="25" cy="41" rx="2.3" ry="1.3" fill={SHU} opacity="0.3" />
      <ellipse cx="39" cy="41" rx="2.3" ry="1.3" fill={SHU} opacity="0.3" />
      <path d="M30.6 43.2 Q32 44.1 33.4 43.2" fill="none" {...thin} strokeWidth="1.3" />
    </>
  );
}

// 10 · Maestro del taijutsu: glossy bowl cut, thick brows, green jumpsuit
function Taijutsu() {
  return (
    <>
      <Backdrop color="#b2532d" />
      <Shoulders fill={LEAF} />
      <path d="M25.5 50.8 Q32 54 38.5 50.8 M32 53.6 L32 64" fill="none" {...thin} />
      <path d="M12 58 L18 56 M52 58 L46 56" stroke="#3a5f2c" strokeWidth="1.4" strokeLinecap="round" />
      <Neck />
      <Head />
      <path d="M19.2 38.5 C17.5 25 23 18 32 18 C41 18 46.5 25 44.8 38.5 L42.4 38.5 L42.4 30.6 L21.6 30.6 L21.6 38.5 Z" fill={INK} {...line} />
      <path d="M24 23.5 Q29.5 20 35.5 21" fill="none" stroke={STEEL_LIGHT} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
      <path d="M23.4 31.6 L30.2 31.8 L30 34.6 L23.6 34.2 Z" fill={INK} />
      <path d="M40.6 31.6 L33.8 31.8 L34 34.6 L40.4 34.2 Z" fill={INK} />
      <circle cx="27.4" cy="37.8" r="2.3" fill={PAPER} {...thin} strokeWidth="1.3" />
      <circle cx="36.6" cy="37.8" r="2.3" fill={PAPER} {...thin} strokeWidth="1.3" />
      <circle cx="27.4" cy="38" r="1.1" fill={INK} />
      <circle cx="36.6" cy="38" r="1.1" fill={INK} />
      <path d="M26.5 41.6 Q32 47.8 37.5 41.6 Q32 43.2 26.5 41.6 Z" fill={PAPER} {...thin} />
      <path d="M46 37 L47 40 L50 41 L47 42 L46 45 L45 42 L42 41 L45 40 Z" fill={PAPER} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
    </>
  );
}

// 11 · ANBU enmascarado: white animal mask with red marks, armour plates
function Anbu() {
  return (
    <>
      <Backdrop color={NIGHT} />
      <path d="M17.5 38 L13 29 L18 27.5 L15.5 18 L23 21 L25 12 L30.5 18 L36 11 L38 19 L46 15.5 L45 25 L51 27 L46.5 38 Z" fill="#3a3f47" {...line} />
      <Shoulders fill="#24314b" />
      <path d="M5 60 C6 54 12 51 19 51.5 L21 58 C15 57.5 9 59 5 62 Z" fill={STEEL} {...thin} />
      <path d="M59 60 C58 54 52 51 45 51.5 L43 58 C49 57.5 55 59 59 62 Z" fill={STEEL} {...thin} />
      <Neck skin="#24314b" />
      <path d="M20.2 31 L18.5 17.5 L26 23.5 Q32 21.8 38 23.5 L45.5 17.5 L43.8 31 C45 41 40 48.5 32 49.5 C24 48.5 19 41 20.2 31 Z" fill={PAPER} {...line} />
      <path d="M20.5 20.5 L25 24.3 L21.3 26 Z M43.5 20.5 L39 24.3 L42.7 26 Z" fill={SHU} />
      <path d="M23.6 33 L29.6 34.6 L28.6 36.8 L24.2 35.3 Z" fill={INK} />
      <path d="M40.4 33 L34.4 34.6 L35.4 36.8 L39.8 35.3 Z" fill={INK} />
      <path d="M32 25.5 L33.6 29.3 L32 31 L30.4 29.3 Z" fill={SHU} />
      <path d="M22.3 39 Q25.5 39.8 27.3 42.5 M41.7 39 Q38.5 39.8 36.7 42.5" fill="none" stroke={SHU} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M30.6 40.4 L33.4 40.4 L32 42.2 Z" fill={INK} />
      <path d="M28.5 45.3 Q32 46.6 35.5 45.3" fill="none" stroke={STEEL_DARK} strokeWidth="1.1" strokeLinecap="round" />
    </>
  );
}

const ART = [
  Bandana, Jonin, RedEye, Medic, ToadSage, WindFan,
  SandGourd, LazyStrategist, BugUser, PaleEyes, Taijutsu, Anbu,
];

// Round avatar. `ring` = the player's colour (optional). `size` in px.
export const Avatar = memo(function Avatar({
  id,
  size = 24,
  ring = null,
  className = '',
  title,
  label = false,
}) {
  const safe = isAvatarId(id) ? id : 0;
  const Art = ART[safe];
  const ringW = !ring ? 0 : size >= 72 ? 4 : size >= 40 ? 3 : size >= 26 ? 2.5 : size >= 20 ? 2 : 1.5;
  return (
    <span
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        padding: ringW,
        background: ring || INK,
      }}
      title={title}
      role={label ? 'img' : undefined}
      aria-label={label ? AVATAR_NAMES[safe] : undefined}
      aria-hidden={label ? undefined : true}
    >
      <span className="avatar-clip">
        <svg viewBox="0 0 64 64" className="avatar-art" focusable="false">
          <Art />
        </svg>
      </span>
    </span>
  );
});

// A seated player's avatar ringed with their piece colour (spectators: grey ring)
export function PlayerAvatar({ player, size = 24, className = '', spectator = false }) {
  if (!player) return null;
  return (
    <Avatar
      id={player.avatarId}
      size={size}
      ring={spectator ? SPECTATOR_RING : pieceColor(player.color)}
      className={className}
    />
  );
}
