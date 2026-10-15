// Overlays shared by the 2D and 3D boards: the phase banner, the "your turn"
// cues and the zoom button column (which also hosts the 2D / 3D switch).

import { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { pieceColor } from '../../utils/theme';
import { PHASE_DESCRIPTIONS, PHASE } from '../../utils/constants';
import { ZoomInIcon, ZoomOutIcon, FitIcon, KunaiIcon } from '../Shared/Icons';
import { useBoardViewMode } from './boardViewMode';
import { useDiceBusy } from '../Dice3D/diceSignal';

/**
 * "¡Tu turno!" cues: a one-shot banner when the turn (or my special build)
 * passes to me, plus a persistent glow around the board while I may act.
 */
function TurnCues({ mine, turnKey, special }) {
  // Remember the last key so the banner fires only on a change, not on load
  const [prevKey, setPrevKey] = useState(turnKey);
  const [flash, setFlash] = useState(null);
  const diceBusy = useDiceBusy();
  if (turnKey !== prevKey) {
    setPrevKey(turnKey);
    if (turnKey) setFlash({ key: turnKey, special });
  }

  // Tab title hint for players looking at another tab
  useEffect(() => {
    if (!mine) return undefined;
    const base = document.title.replace(/^● Tu turno · /, '');
    document.title = `● Tu turno · ${base}`;
    return () => {
      document.title = base;
    };
  }, [mine]);

  return (
    <>
      {mine && <div className="turn-glow" aria-hidden="true" />}
      {flash && flash.key === turnKey && (
        // A quick roll right after the turn starts: the dice take the stage
        <div className={`turn-banner-wrap${diceBusy ? ' is-hidden' : ''}`}>
          <div key={flash.key} className="turn-banner" role="status" aria-live="polite">
            <div className="turn-banner-strip">
              <span className="turn-banner-title">¡Tu turno!</span>
              <span className="turn-banner-sub">{flash.special ? 'Construcción especial' : 'Es tu momento, ninja'}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const BUILD_NAMES = {
  road: 'CAMINO',
  settlement: 'POBLADO',
  city: 'CIUDAD',
};

/** Phase banner (paper slip pinned to the table) + turn cues */
export function BoardBanner() {
  const { gameState, isMyTurn, isSpecialBuild, isMySpecialBuild, buildMode } = useGame();
  if (!gameState) return null;

  const currentTurnPlayer = gameState.players?.[gameState.currentPlayerId];
  const specialBuilder = isSpecialBuild ? gameState.players?.[gameState.specialBuilderId] : null;
  // The banner speaks to whoever may act right now
  const bannerMine = isSpecialBuild ? isMySpecialBuild : isMyTurn;

  // Helper description for banner
  let bannerText = PHASE_DESCRIPTIONS[gameState.phase] || '';
  if (isSpecialBuild) {
    if (isMySpecialBuild) {
      bannerText = buildMode
        ? `Construcción especial: selecciona un marcador resaltado para tu ${BUILD_NAMES[buildMode] || buildMode.toUpperCase()}`
        : 'Tu construcción especial: construye o compra cartas, luego pulsa «Terminar construcción»';
    } else {
      bannerText = `Fase especial de construcción: turno de ${specialBuilder?.name || 'otro ninja'}…`;
    }
  } else if (isMyTurn) {
    if (gameState.phase === PHASE.MAIN) {
      if (buildMode) {
        bannerText = `Selecciona un marcador resaltado para construir tu ${BUILD_NAMES[buildMode] || buildMode.toUpperCase()}`;
      } else {
        bannerText = 'Tu Turno: Lanza los dados, comercia, construye o pasa turno';
      }
    } else if (gameState.phase === PHASE.ROBBER_MOVE) {
      bannerText = 'Haz clic en otro hexágono para mover al ladrón renegado';
    }
  } else {
    bannerText = `Esperando a ${currentTurnPlayer?.name || 'oponente'} (${
      PHASE_DESCRIPTIONS[gameState.phase] || 'jugando'
    }...)`;
  }

  const turnColor = pieceColor((specialBuilder || currentTurnPlayer)?.color);

  // Identifies "my chance to act": changes when the turn / special build passes to me
  const turnKey = bannerMine
    ? `${gameState.turnNumber}:${gameState.currentPlayerId}:${isSpecialBuild ? `sb-${gameState.specialBuilderId}` : 'turn'}`
    : null;

  return (
    <>
      <div className="absolute top-3 sm:top-4 left-3 md:left-1/2 md:-translate-x-1/2 z-10 pointer-events-none w-max max-w-[calc(100%-8.5rem)] md:max-w-[calc(100%-2rem)]">
        <div
          key={bannerText}
          className="paper animate-fade-in flex items-stretch rounded-[1px] border border-ink/70 shadow-[0_6px_14px_-4px_rgba(0,0,0,0.7)] text-ink text-[13px] sm:text-sm leading-snug overflow-hidden"
        >
          <span
            className="w-2 shrink-0 border-r border-ink/40"
            style={{ backgroundColor: turnColor }}
            aria-hidden="true"
          />
          <span className="flex items-center gap-2 pl-2.5 pr-3.5 py-1.5">
            <KunaiIcon className={`w-4 h-4 shrink-0 ${bannerMine ? 'text-shu' : 'text-ink-faint'}`} />
            <span className={bannerMine ? 'font-bold' : 'font-medium text-ink-soft'}>{bannerText}</span>
          </span>
        </div>
      </div>

      <TurnCues mine={bannerMine} turnKey={turnKey} special={isSpecialBuild} />
    </>
  );
}

const ZOOM_BTN =
  'p-2 text-ink hover:bg-chakra/20 hover:text-shu disabled:opacity-35 cursor-pointer disabled:cursor-default';

/** "2D / 3D" switch: the active mode is inked, the other one faint */
function ViewModeToggle() {
  const view = useBoardViewMode();
  if (!view) return null;
  const is3D = view.mode === '3d';
  const title = !view.webgl
    ? 'Tu dispositivo no admite el tablero 3D'
    : is3D
      ? 'Cambiar al tablero 2D'
      : 'Cambiar al tablero 3D';
  return (
    <button
      type="button"
      onClick={view.toggle}
      disabled={!view.webgl}
      className="px-1.5 py-1.5 text-[11px] font-black leading-none tracking-tight text-ink hover:bg-chakra/20 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed border-b border-ink/40 flex flex-col items-center gap-0.5"
      title={title}
      aria-label={title}
      aria-pressed={is3D}
    >
      <span className={is3D ? 'text-ink-faint/80' : 'text-shu'}>2D</span>
      <span className="block w-3.5 h-px bg-ink/40" aria-hidden="true" />
      <span className={is3D ? 'text-shu' : 'text-ink-faint/80'}>3D</span>
    </button>
  );
}

/** Bottom-right column: [2D/3D] + zoom in / out / fit */
export function ZoomControls({ zoomIn, zoomOut, reset, canZoomIn = true, canZoomOut = true, canReset = canZoomOut }) {
  return (
    <div className="absolute bottom-3 right-3 z-10 flex flex-col paper border border-ink/70 rounded-[2px] shadow-[0_4px_10px_rgba(0,0,0,0.55)] overflow-hidden">
      <ViewModeToggle />
      <button type="button" onClick={zoomIn} disabled={!canZoomIn} className={ZOOM_BTN} title="Acercar" aria-label="Acercar">
        <ZoomInIcon className="w-4 h-4" />
      </button>
      <button type="button" onClick={zoomOut} disabled={!canZoomOut} className={`${ZOOM_BTN} border-t border-ink/25`} title="Alejar" aria-label="Alejar">
        <ZoomOutIcon className="w-4 h-4" />
      </button>
      <button type="button" onClick={reset} disabled={!canReset} className={`${ZOOM_BTN} border-t border-ink/25`} title="Ver todo el tablero" aria-label="Ver todo el tablero">
        <FitIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
