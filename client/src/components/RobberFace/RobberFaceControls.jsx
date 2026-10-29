import { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { EyeIcon, FlagIcon, RobberIcon } from '../Shared/Icons';
import { RobberFaceDialog } from './RobberFaceDialog';
import { setRobberFaceHidden, useRobberFaceData, useRobberFaceHidden } from './robberFaceStore';

/** Round thumbnail of the face (or the faceless robber) */
function FaceThumb({ face, size = 28 }) {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden border border-ink/30 bg-night text-paper-light/80"
      style={{ width: size, height: size }}
    >
      {face ? <img src={face.image} alt="" className="w-full h-full object-cover" /> : <RobberIcon className="w-3/5 h-3/5" />}
    </span>
  );
}

const btn = 'btn btn-ghost min-h-[34px] px-2.5 py-1 text-[12px] shrink-0';

/**
 * Waiting room: «Ladrón» next to the board theme. The host puts / changes the
 * face; everyone else sees it and can hide it on their own screen.
 */
export function RobberFaceRule({ className = '' }) {
  const { isHost } = useGame();
  const face = useRobberFaceData();
  const hidden = useRobberFaceHidden();
  const [open, setOpen] = useState(false);
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="label-caps block mb-1">Ladrón</span>
      <span className="flex items-center gap-1.5 min-h-[34px]">
        <FaceThumb face={face && !hidden ? face : null} />
        {isHost ? (
          <button type="button" className={btn} onClick={() => setOpen(true)}>
            {face ? 'Cambiar' : 'Ponerle cara'}
          </button>
        ) : face ? (
          <button type="button" className={btn} onClick={() => setRobberFaceHidden(!hidden)} aria-pressed={hidden}>
            {hidden ? 'Mostrar' : 'Ocultar'}
          </button>
        ) : (
          <span className="font-serif font-extrabold text-[17px] text-ink leading-tight">Sin cara</span>
        )}
      </span>
      {open && <RobberFaceDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

/**
 * Room menu (in game): the current face, «Ocultar / Mostrar» for me,
 * «Reportar» the one who put it and, for the host, change / remove it.
 */
export function RobberFaceMenuSection({ onReport }) {
  const { isHost, myPlayerId, gameState } = useGame();
  const face = useRobberFaceData();
  const hidden = useRobberFaceHidden();
  const [open, setOpen] = useState(false);
  if (!face && !isHost) return null;
  const by = face ? gameState?.players?.[face.by] : null;
  return (
    <div className="mb-4">
      <div className="label-caps mb-1">Cara del ladrón</div>
      <div className="flex items-center justify-between gap-2 py-1.5 border-y border-ink/15">
        <span className="flex items-center gap-2 min-w-0">
          <FaceThumb face={face && !hidden ? face : null} size={32} />
          <span className="text-[13px] text-ink-soft truncate">
            {!face ? 'Sin cara' : hidden ? 'Oculta en tu pantalla' : by ? `Puesta por ${by.name}` : 'Puesta por el anfitrión'}
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {face && (
            <button type="button" className={btn} onClick={() => setRobberFaceHidden(!hidden)} aria-pressed={hidden}>
              <EyeIcon className="w-3.5 h-3.5" />
              {hidden ? 'Mostrar' : 'Ocultar'}
            </button>
          )}
          {face && face.by !== myPlayerId && (
            <button
              type="button"
              className={btn}
              onClick={() => onReport({ id: face.by, name: by ? by.name : 'el anfitrión', reason: 'imagen' })}
              title="Reportar esta cara"
              aria-label="Reportar esta cara"
            >
              <FlagIcon className="w-3.5 h-3.5" />
            </button>
          )}
          {isHost && (
            <button type="button" className={btn} onClick={() => setOpen(true)}>
              {face ? 'Cambiar' : 'Ponerle cara'}
            </button>
          )}
        </span>
      </div>
      {open && <RobberFaceDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
