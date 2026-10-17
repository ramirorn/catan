// Board animations shown to every player and spectator, driven by the
// server's public event feed (gameState.recentEvents, ids always grow):
// city upgrade, robber leap, steal, development cards and «near win».
//
// Events play one after another (a small queue), never on top of the dice:
// an animation waits for the dice to finish, and the dice wait for the
// animation on screen (fxSignal). Modals that should not cover them wait for
// the whole stage (useStageReady). Events that already existed when this
// client joined / reconnected are ignored.
//
// three.js lives in the lazy FxScene chunk (shared with the dice), mounted
// only while something plays. Reduced motion, no WebGL or a slow chunk get a
// short static card instead; pieces are always revealed in the end.

import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { PHASE, RESOURCE_NAMES } from '../../utils/constants';
import { pieceColor } from '../../utils/theme';
import { Avatar } from '../Shared/Avatar';
import { hasWebGL, isLowPowerDevice } from '../Board/boardViewMode';
import { isDiceBusy, whenDiceIdle } from '../Dice3D/diceSignal';
import {
  clearFxHidden,
  getBoardBridge,
  hideFx,
  setFxPending,
  setFxPlaying,
  unhideFx,
} from './fxSignal';

const loadFxScene = () => import('./FxScene');
const FxScene = lazy(loadFxScene);

// If the scene has not drawn its first frame by then, this one goes static
const START_TIMEOUT_MS = 1200;
// Extra time after an animation's planned end before we force it to finish
const SAFETY_MS = 2500;
const STATIC_MS = { city: 900, robber: 900, steal: 1100, devCard: 1500, nearWin: 1800, pact: 1500 };
// After the last animation the idle canvas (no frames drawn) is kept this
// long, so chained events (Knight → renegade → steal) share one WebGL context
const KEEP_ALIVE_MS = 12000;

export const DEV_CARD_TITLES = {
  knight: 'Caballero',
  roadBuilding: 'Construcción de caminos',
  yearOfPlenty: 'Año de la abundancia',
  monopoly: 'Monopolio',
};

function prefersReducedMotion() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Board animation failed, using the static card', error);
    this.props.onFail?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ─── event → animation item ─── */

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function resolveEvent(ev, gs) {
  const board = gs?.board;
  const players = gs?.players || {};
  if (!board) return null;
  const nameOf = (id) => players[id]?.name || 'Un ninja';
  const colorOf = (id) => pieceColor(players[id]?.color);
  const base = { id: ev.id };

  switch (ev.type) {
    case 'cityUpgrade': {
      const v = board.vertices?.[ev.vertexId];
      if (!v) return null;
      return {
        ...base,
        kind: 'city',
        x: v.x,
        y: v.y,
        color: colorOf(ev.playerId),
        hideKey: `vertex:${ev.vertexId}`,
        focus: true,
        revealAt: 0.55,
        dur: 1.6,
        caption: { title: '¡Nueva ciudad!', sub: `${nameOf(ev.playerId)} mejoró un poblado`, color: colorOf(ev.playerId) },
      };
    }
    case 'robberMoved': {
      const from = board.hexes?.[ev.fromHex];
      const to = board.hexes?.[ev.toHex];
      if (!to) return null;
      return {
        ...base,
        kind: 'robber',
        fromX: (from || to).x,
        fromY: (from || to).y,
        toX: to.x,
        toY: to.y,
        hideKey: 'robber',
        revealAt: 1.0,
        dur: 1.45,
        caption: { title: 'El renegado se mueve', sub: `lo envía ${nameOf(ev.playerId)}`, color: colorOf(ev.playerId) },
      };
    }
    case 'steal': {
      // From the victim's building next to the robber to the thief's closest one
      const verts = Object.values(board.vertices || {});
      const robberHex = board.robberHex;
      const hex = board.hexes?.[robberHex];
      const victimBuildings = verts.filter((v) => v.building?.playerId === ev.victimId);
      const from =
        victimBuildings.find((v) => v.adjacentHexes?.includes(robberHex)) ||
        (hex && victimBuildings.sort((a, b) => dist2(a, hex) - dist2(b, hex))[0]) ||
        hex;
      if (!from) return null;
      const thiefBuildings = verts.filter((v) => v.building?.playerId === ev.thiefId);
      const to = thiefBuildings.sort((a, b) => dist2(a, from) - dist2(b, from))[0] || { x: from.x + 90, y: from.y - 60 };
      return {
        ...base,
        kind: 'steal',
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        thiefColor: colorOf(ev.thiefId),
        dur: 1.5,
        caption: {
          title: '¡Carta robada!',
          sub: `${nameOf(ev.thiefId)} le roba una carta a ${nameOf(ev.victimId)}`,
          color: colorOf(ev.thiefId),
        },
      };
    }
    case 'devCard': {
      if (!DEV_CARD_TITLES[ev.cardType]) return null;
      let detail = '';
      if (ev.cardType === 'monopoly' && ev.resource) {
        detail = ` · ${RESOURCE_NAMES[ev.resource] || ev.resource}${Number.isInteger(ev.total) ? ` (${ev.total})` : ''}`;
      } else if (ev.cardType === 'yearOfPlenty' && Array.isArray(ev.resources)) {
        detail = ` · ${ev.resources.map((r) => RESOURCE_NAMES[r] || r).join(' + ')}`;
      }
      return {
        ...base,
        kind: 'devCard',
        cardType: ev.cardType,
        resource: ev.resource || 'wheat',
        resources: Array.isArray(ev.resources) && ev.resources.length ? ev.resources : ['wheat', 'wood', 'ore'],
        dur: 1.8,
        caption: {
          title: DEV_CARD_TITLES[ev.cardType],
          sub: `jugada por ${nameOf(ev.playerId)}${detail}`,
          color: colorOf(ev.playerId),
          big: true,
        },
      };
    }
    case 'peacePact': {
      // Public: who signed with whom (never the cards)
      return {
        ...base,
        kind: 'pact',
        fromColor: colorOf(ev.fromId),
        toColor: colorOf(ev.toId),
        dur: 2.0,
        caption: {
          title: 'Pacto de paz',
          sub: `${nameOf(ev.fromId)} y ${nameOf(ev.toId)} firmaron la paz`,
          color: '#f4efe2',
          big: true,
        },
      };
    }
    case 'nearWin': {
      const left = Number.isInteger(ev.vpLeft) && ev.vpLeft > 0 ? ev.vpLeft : 2;
      return {
        ...base,
        kind: 'nearWin',
        color: colorOf(ev.playerId),
        vpLeft: left,
        dur: 2.3,
        caption: {
          title: `¡A ${left} punto${left === 1 ? '' : 's'} de la victoria!`,
          sub: nameOf(ev.playerId),
          color: colorOf(ev.playerId),
          avatarId: players[ev.playerId]?.avatarId ?? null,
          big: true,
          hero: true,
        },
      };
    }
    default:
      return null;
  }
}

/* ─── caption (crisp HTML text over the canvas) ─── */

function FxCaption({ item, mode }) {
  const c = item.caption;
  if (!c) return null;
  const dur = mode === 'static' ? STATIC_MS[item.kind] / 1000 : item.dur;
  return (
    <div
      key={item.id}
      className={`fx-caption${c.big ? ' is-big' : ''}${c.hero ? ' is-hero' : ''}${mode === 'static' ? ' is-static' : ''}`}
      style={{ '--fx-dur': `${dur}s`, '--fx-color': c.color }}
    >
      <span className="fx-caption-title">{c.title}</span>
      {c.sub && c.avatarId != null ? (
        <span className="fx-caption-who">
          <Avatar id={c.avatarId} size={26} ring={c.color} />
          <span className="fx-caption-sub">{c.sub}</span>
        </span>
      ) : c.sub && <span className="fx-caption-sub">{c.sub}</span>}
    </div>
  );
}

/* ─── overlay ─── */

export function FxOverlay() {
  const { gameState } = useGame();
  const events = gameState?.recentEvents;
  const lastId = events?.length ? events[events.length - 1].id : 0;
  const phase = gameState?.phase;

  const [webgl] = useState(hasWebGL);
  const [lowPower] = useState(isLowPowerDevice);
  // { item, mode: '3d' | 'static', started }
  const [current, setCurrent] = useState(null);
  const [sceneAlive, setSceneAlive] = useState(false);

  const seenRef = useRef(undefined);
  const queueRef = useRef([]);
  const activeRef = useRef(null); // the item playing (null between items)
  const waitRef = useRef(null); // cancel fn while waiting for the dice
  const timersRef = useRef([]);
  const revealedRef = useRef(false);
  const focusOffRef = useRef(null);
  const sceneBrokenRef = useRef(false);
  const gameRef = useRef(gameState);
  useLayoutEffect(() => {
    gameRef.current = gameState;
  });

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    const item = activeRef.current;
    if (item?.hideKey) unhideFx(item.hideKey);
  }, []);

  const pumpRef = useRef(() => {});

  const finish = useCallback(() => {
    const item = activeRef.current;
    if (!item) return;
    clearTimers();
    reveal();
    activeRef.current = null;
    setCurrent(null);
    setFxPlaying(false); // the dice may take the stage now
    pumpRef.current();
  }, [reveal]);

  const pump = useCallback(() => {
    if (activeRef.current || waitRef.current) return;
    const next = queueRef.current[0];
    if (!next) {
      setFxPending(false);
      return;
    }
    setFxPending(true);
    // Never on top of the dice: wait until the throw (and its stamp) is gone
    if (isDiceBusy()) {
      waitRef.current = whenDiceIdle(() => {
        waitRef.current = null;
        pumpRef.current();
      });
      return;
    }
    queueRef.current.shift();
    activeRef.current = next;
    revealedRef.current = false;
    setFxPlaying(true);
    const reduced = prefersReducedMotion();
    const use3d = webgl && !reduced && !sceneBrokenRef.current;
    setCurrent({ item: next, mode: use3d ? '3d' : 'static', started: !use3d, reduced });
  }, [webgl]);
  useLayoutEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  // New events → queue. Layout effect: pieces to hide vanish before paint.
  useLayoutEffect(() => {
    if (seenRef.current === undefined) {
      seenRef.current = lastId; // events from before we joined
      return;
    }
    if (lastId < seenRef.current) {
      seenRef.current = lastId; // a new game in this room: counters restarted
      return;
    }
    if (lastId === seenRef.current) return;
    const fresh = (events || []).filter((ev) => ev.id > seenRef.current);
    seenRef.current = lastId;
    if (document.hidden) return; // background tab: nothing to watch
    for (const ev of fresh) {
      const item = resolveEvent(ev, gameRef.current);
      if (!item) continue;
      if (item.hideKey) hideFx(item.hideKey);
      queueRef.current.push(item);
    }
    pump();
    // the id is the trigger; the events ride along
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId, pump]);

  // Warm the chunk up when the game is under way (dice share it anyway)
  useEffect(() => {
    if (phase === PHASE.ROLL_DICE && webgl && !prefersReducedMotion()) loadFxScene().catch(() => {});
  }, [phase, webgl]);

  // Per item: start (camera fly + timers) once the scene draws, or at once when static
  const curId = current?.item.id;
  const curMode = current?.mode;
  const curStarted = current?.started;
  useEffect(() => {
    if (curId === undefined) return undefined;
    const item = activeRef.current;
    if (!item || item.id !== curId) return undefined;
    if (!curStarted) {
      // 3D scene still loading: give it a moment, then go static
      const t = setTimeout(() => {
        setCurrent((c) => (c && c.item.id === curId && !c.started ? { ...c, mode: 'static', started: true } : c));
      }, START_TIMEOUT_MS);
      return () => clearTimeout(t);
    }
    clearTimers();
    const later = (fn, ms) => timersRef.current.push(setTimeout(fn, ms));
    if (item.focus && !current?.reduced) {
      const bridge = getBoardBridge();
      focusOffRef.current = bridge?.focus?.(item.x, item.y, { inMs: 450, holdMs: 620, outMs: 450 }) || null;
    }
    if (curMode === 'static') {
      reveal();
      later(finish, STATIC_MS[item.kind] || 1000);
    } else {
      // the scene reports reveal / done; these only make sure it happens
      later(reveal, (item.revealAt ?? 0) * 1000 + SAFETY_MS);
      later(finish, item.dur * 1000 + SAFETY_MS);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curId, curMode, curStarted]);

  const onStart = useCallback(() => {
    setCurrent((c) => (c && !c.started ? { ...c, started: true } : c));
  }, []);
  const onFail = useCallback(() => {
    sceneBrokenRef.current = true;
    setCurrent((c) => (c ? { ...c, mode: 'static', started: true } : c));
  }, []);

  // Leaving the game screen: drop everything, show every piece
  useEffect(
    () => () => {
      clearTimers();
      waitRef.current?.();
      focusOffRef.current?.();
      queueRef.current = [];
      activeRef.current = null;
      clearFxHidden();
      setFxPlaying(false);
      setFxPending(false);
    },
    []
  );

  // Keep the (idle) canvas a little while after a 3D animation
  const playing3d = current?.mode === '3d';
  useEffect(() => {
    if (playing3d) {
      setSceneAlive(true);
      return undefined;
    }
    const t = setTimeout(() => setSceneAlive(false), KEEP_ALIVE_MS);
    return () => clearTimeout(t);
  }, [playing3d]);

  if (!current && !sceneAlive) return null;
  const item = current?.item ?? null;
  const mode = current?.mode;
  const started = current?.started;

  return (
    <div className={`fx-overlay${item ? '' : ' is-idle'}`}>
      {(playing3d || (sceneAlive && !item)) && (
        // Same canvas for back-to-back animations (one WebGL context)
        <SceneBoundary onFail={onFail}>
          <Suspense fallback={null}>
            <FxScene
              item={playing3d ? item : null}
              lowPower={lowPower}
              onStart={onStart}
              onReveal={reveal}
              onDone={finish}
            />
          </Suspense>
        </SceneBoundary>
      )}
      {item && started && <FxCaption item={item} mode={mode} />}
      <span className="sr-only" role="status" aria-live="polite">
        {item?.caption ? `${item.caption.title}. ${item.caption.sub || ''}` : ''}
      </span>
    </div>
  );
}
