// Picks the board renderer: the SVG board (2D, always available) or the
// three.js board (3D, lazy-loaded so three.js is only downloaded when used).

import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { HexBoard } from './HexBoard';
import { BoardViewContext, hasWebGL, initialViewMode, storeViewMode } from './boardViewMode';
import { BoardTooltip } from './BoardTooltip';
import { resetTip } from './boardTip';

const HexBoard3D = lazy(() => import('../Board3D/HexBoard3D'));

/** If the 3D board crashes (driver, lost context…), fall back to 2D */
class Board3DBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('3D board failed, falling back to 2D', error);
    this.props.onFail?.();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function BoardView() {
  const { addToast } = useGame();
  const [webgl] = useState(hasWebGL);
  const [mode, setModeState] = useState(initialViewMode);

  const setMode = useCallback(
    (next) => {
      const m = next === '3d' && webgl ? '3d' : '2d';
      setModeState(m);
      storeViewMode(m);
    },
    [webgl]
  );
  const toggle = useCallback(() => setMode(mode === '3d' ? '2d' : '3d'), [mode, setMode]);

  const onFail = useCallback(() => {
    setModeState('2d');
    addToast?.('El tablero 3D no pudo iniciarse; volvemos al 2D', 'error');
  }, [addToast]);

  const value = useMemo(() => ({ mode, webgl, toggle, setMode }), [mode, webgl, toggle, setMode]);

  // Switching 2D ↔ 3D drops any info card of the old board
  useEffect(() => resetTip(), [mode]);

  return (
    <BoardViewContext.Provider value={value}>
      {mode === '3d' ? (
        <Board3DBoundary fallback={<HexBoard />} onFail={onFail}>
          {/* While three.js downloads, keep showing the 2D board */}
          <Suspense fallback={<HexBoard />}>
            <HexBoard3D />
          </Suspense>
        </Board3DBoundary>
      ) : (
        <HexBoard />
      )}
      {/* Hover / long-press info cards (shared by both boards) */}
      <BoardTooltip />
    </BoardViewContext.Provider>
  );
}
