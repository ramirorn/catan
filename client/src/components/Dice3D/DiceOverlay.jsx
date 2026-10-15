// Dice throw shown to every player whenever someone rolls: two 3D dice fly
// over the board (2D or 3D), tumble, bounce and settle on the server's
// result, then a stamp with the total appears and everything fades out.
//
// Lightweight on purpose: three.js lives in the lazy DiceScene chunk (shared
// with the 3D board), mounted only while a throw is on screen. Without WebGL,
// with reduced motion, or if the chunk is slow to arrive, a static stamp is
// shown instead.

import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { PHASE } from '../../utils/constants';
import { hasWebGL, isLowPowerDevice } from '../Board/boardViewMode';
import { DieFace } from '../HUD/DiceRoll';
import { setDiceBusy } from './diceSignal';

const loadDiceScene = () => import('./DiceScene');
const DiceScene = lazy(loadDiceScene);

// If the scene has not drawn its first frame by then (chunk still loading),
// this roll falls back to the static stamp
const START_TIMEOUT_MS = 900;
// Safety net if the scene never reports the dice as settled
const THROW_MAX_MS = 3500;
// How long the stamp stays before fading (3D throw / static stamp)
const STAMP_HOLD_MS = 2200;
const STATIC_HOLD_MS = 2000;
const FADE_MS = 450;

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
    console.error('Dice scene failed, using the flat stamp', error);
    this.props.onFail?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function ResultStamp({ roll, showFaces }) {
  const seven = roll.total === 7;
  return (
    <div className={`dice-stamp${showFaces ? ' is-static' : ''}`} aria-hidden="true">
      <div className="dice-stamp-row">
        {showFaces && <DieFace value={roll.die1} label={false} className="dice-stamp-die" />}
        <div className={`dice-stamp-seal${seven ? ' is-seven' : ''}`}>{roll.total}</div>
        {showFaces && <DieFace value={roll.die2} label={false} className="dice-stamp-die" />}
      </div>
      {seven && <div className="dice-stamp-thief">¡Ladrón!</div>}
      <div className="dice-stamp-caption">
        {roll.roller ? `${roll.roller} · ` : ''}
        {roll.die1} + {roll.die2}
      </div>
    </div>
  );
}

export function DiceOverlay() {
  const { gameState } = useGame();
  const lastRoll = gameState?.lastDiceRoll ?? null;
  const rollId = lastRoll?.id ?? null;
  const phase = gameState?.phase;

  // { id, die1, die2, total, roller, mode: '3d' | 'static', stage: 'throw' | 'stamp' | 'out' }
  const [anim, setAnim] = useState(null);
  const seenIdRef = useRef(undefined);
  const startedRef = useRef(false);
  const sceneBrokenRef = useRef(false);
  const [webgl] = useState(hasWebGL);
  const [lowPower] = useState(isLowPowerDevice);

  const die1 = lastRoll?.die1;
  const die2 = lastRoll?.die2;
  const total = lastRoll?.total;
  const roller = gameState?.players?.[gameState?.currentPlayerId]?.name || '';

  // New roll → start a throw. Layout effect: the HUD dice go blank before paint.
  useLayoutEffect(() => {
    if (seenIdRef.current === undefined) {
      // First state (fresh game, reload, reconnect): an old roll, not a throw
      seenIdRef.current = rollId;
      return;
    }
    if (rollId === null || rollId === seenIdRef.current) return;
    seenIdRef.current = rollId;
    if (document.hidden) return; // background tab: nothing to watch

    const use3d = webgl && !sceneBrokenRef.current && !prefersReducedMotion();
    startedRef.current = false;
    setAnim({ id: rollId, die1, die2, total, roller, mode: use3d ? '3d' : 'static', stage: use3d ? 'throw' : 'stamp' });
    setDiceBusy(true);
    // Only a new id starts a throw; the other values just ride along
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollId, webgl]);

  // Fetch the dice chunk while someone is about to roll, so the first throw is instant
  useEffect(() => {
    if (phase === PHASE.ROLL_DICE && webgl && !prefersReducedMotion()) {
      loadDiceScene().catch(() => {});
    }
  }, [phase, webgl]);

  const animId = anim?.id;
  const stage = anim?.stage;
  const mode = anim?.mode;

  // Stage timers
  useEffect(() => {
    if (!stage) return undefined;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const toStatic = () =>
      setAnim((a) => (a && a.id === animId && a.stage === 'throw' ? { ...a, mode: 'static', stage: 'stamp' } : a));

    if (stage === 'throw') {
      later(() => {
        if (!startedRef.current) toStatic();
      }, START_TIMEOUT_MS);
      later(() => setAnim((a) => (a && a.id === animId && a.stage === 'throw' ? { ...a, stage: 'stamp' } : a)), THROW_MAX_MS);
    } else if (stage === 'stamp') {
      later(() => {
        setAnim((a) => (a && a.id === animId ? { ...a, stage: 'out' } : a));
      }, mode === '3d' ? STAMP_HOLD_MS : STATIC_HOLD_MS);
    } else if (stage === 'out') {
      // Only release waiters (e.g. "Recursos recibidos") once the dice are gone
      later(() => {
        setAnim((a) => (a && a.id === animId ? null : a));
        setDiceBusy(false);
      }, FADE_MS);
    }
    return () => timers.forEach(clearTimeout);
  }, [animId, stage, mode]);

  // Leaving the game screen mid-throw must not leave the flag up
  useEffect(() => () => setDiceBusy(false), []);

  const onStart = useCallback(() => {
    startedRef.current = true;
  }, []);
  const onSettled = useCallback(() => {
    setAnim((a) => (a && a.id === animId && a.stage === 'throw' ? { ...a, stage: 'stamp' } : a));
  }, [animId]);
  const onFail = useCallback(() => {
    sceneBrokenRef.current = true;
    setAnim((a) => (a && a.id === animId ? { ...a, mode: 'static', stage: a.stage === 'out' ? 'out' : 'stamp' } : a));
  }, [animId]);

  if (!anim) return null;

  return (
    <div className={`dice-overlay${anim.stage === 'out' ? ' is-out' : ''}`}>
      <span className="sr-only" role="status" aria-live="polite">
        {anim.stage === 'throw' ? '' : `${anim.roller || 'Se'} sacó ${anim.die1} + ${anim.die2} = ${anim.total}`}
      </span>
      {anim.mode === '3d' && (
        <SceneBoundary key={anim.id} onFail={onFail}>
          <Suspense fallback={null}>
            <DiceScene
              die1={anim.die1}
              die2={anim.die2}
              seed={anim.id}
              lowPower={lowPower}
              onStart={onStart}
              onSettled={onSettled}
            />
          </Suspense>
        </SceneBoundary>
      )}
      {anim.stage !== 'throw' && <ResultStamp roll={anim} showFaces={anim.mode === 'static'} />}
    </div>
  );
}
