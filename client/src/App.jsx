import { useCallback, useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { GameProvider, useGame } from './context/GameContext';
import { PHASE } from './utils/constants';

import { HomeScreen } from './components/Menu/HomeScreen';
import { WaitingRoom } from './components/Lobby/WaitingRoom';
import { BoardView } from './components/Board/BoardView';
import { DiceOverlay } from './components/Dice3D/DiceOverlay';
import { FxOverlay } from './components/Effects/FxOverlay';
import { GameHeader } from './components/HUD/GameHeader';
import { ResourceBar } from './components/HUD/ResourceBar';
import { ActionPanel } from './components/HUD/ActionPanel';
import { DiceRoll } from './components/HUD/DiceRoll';
import { ScoreBoard } from './components/HUD/ScoreBoard';
import { GameLog } from './components/HUD/GameLog';

import { TradeModal } from './components/Trade/TradeModal';
import { DevCardModal } from './components/DevCards/DevCardModal';
import { DiscardModal } from './components/Robber/DiscardModal';
import { StealModal } from './components/Robber/StealModal';
import { PeacePactModal, PeacePactPrompt } from './components/Robber/PeacePact';
import { GameOverModal } from './components/GameOver/GameOverModal';
import { ProductionModal } from './components/HUD/ProductionModal';
import { EndGameModal } from './components/HUD/EndGameModal';
import { RoomMenuModal } from './components/HUD/RoomMenuModal';
import { ToastContainer } from './components/Shared/Toast';
import { PwaLayer } from './components/Shared/Pwa';
import { CloseIcon, ScrollIcon, EyeIcon } from './components/Shared/Icons';

/**
 * Keeps two CSS variables in sync with the part of the page that is really
 * visible (iOS shrinks it when the keyboard opens), so the phone drawer and
 * its chat box stay above the keyboard; html[data-kb] marks an open keyboard.
 * Also blocks Safari's page pinch-zoom on the game screen (the board has its
 * own zoom).
 */
function useGameViewport(active) {
  useEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    const vv = window.visualViewport;
    const update = () => {
      if (!vv) return;
      root.style.setProperty('--vv-h', `${Math.round(vv.height)}px`);
      root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
      const keyboard = vv.scale < 1.05 && window.innerHeight - vv.height > 140;
      root.toggleAttribute('data-kb', keyboard);
    };
    const stopZoom = (e) => e.preventDefault();
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    document.addEventListener('gesturestart', stopZoom);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      document.removeEventListener('gesturestart', stopZoom);
      root.style.removeProperty('--vv-h');
      root.style.removeProperty('--vv-top');
      root.removeAttribute('data-kb');
    };
  }, [active]);
}

function GameContent() {
  const { gameState, activeModal, setActiveModal, isSpectator, myPlayerId } = useGame();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Main menu screen ('menu' | 'play' | 'shop' | 'profile'); kept while in a
  // room so leaving a game goes back to where the player was
  const [menuScreen, setMenuScreen] = useState('menu');
  const inGame = !!gameState && gameState.phase !== PHASE.LOBBY;
  useGameViewport(inGame);
  const closePactModal = useCallback(() => setActiveModal((m) => (m === 'peacePact' ? null : m)), [setActiveModal]);

  // If not joined any room yet
  if (!gameState) {
    return <HomeScreen screen={menuScreen} onScreen={setMenuScreen} />;
  }

  // Pre-game lobby room
  if (gameState.phase === PHASE.LOBBY) {
    return <WaitingRoom />;
  }

  // Active game (Setup, Main, Robber, Game Over)
  return (
    <div className="game-ui game-shell night-surface relative h-dvh w-full overflow-hidden text-ink font-sans">
      {/* Top Header */}
      <GameHeader />

      {/* Main Content Area */}
      <div className="hud-main relative flex overflow-hidden min-h-0 min-w-0">
        {/* Center SVG Board Area */}
        <main className="relative flex-1 h-full w-full min-w-0 flex items-center justify-center overflow-hidden">
          <BoardView />
          {/* Dice throw seen by every player (over the 2D or 3D board, never clickable) */}
          <DiceOverlay />
          {/* City upgrade, robber, steal, dev cards, near win: same for everyone */}
          <FxOverlay />

          {/* Mobile sidebar toggle button */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="hidden compact:inline-flex absolute top-2 sm:top-3 right-[max(0.5rem,env(safe-area-inset-right))] sm:right-[max(0.75rem,env(safe-area-inset-right))] z-20 btn paper min-h-[40px] px-2.5 py-1.5 text-xs border border-ink/70 shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
            aria-expanded={mobileSidebarOpen}
            aria-controls="game-sidebar"
          >
            {mobileSidebarOpen ? <CloseIcon className="w-4 h-4" /> : <ScrollIcon className="w-4 h-4" />}
            <span>{mobileSidebarOpen ? 'Cerrar' : 'Registro'}</span>
          </button>
        </main>

        {/* Mobile scrim */}
        {mobileSidebarOpen && (
          <div
            className="hidden compact:block fixed inset-0 z-40 bg-night-dark/55 animate-fade-in"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Right Sidebar: Standings & Live Log/Chat */}
        <aside
          id="game-sidebar"
          className={`hud-drawer paper relative z-30 w-80 shrink-0 flex flex-col border-l-[3px] border-ink shadow-[-10px_0_24px_-10px_rgba(0,0,0,0.7)] ${
            mobileSidebarOpen ? 'is-open' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="hidden compact:flex absolute top-[calc(env(safe-area-inset-top)+0.4rem)] right-[calc(env(safe-area-inset-right)+0.4rem)] z-10 w-10 h-10 items-center justify-center rounded-full text-ink-faint hover:text-ink hover:bg-ink/5"
            aria-label="Cerrar"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
          <ScoreBoard />
          <GameLog />
        </aside>
      </div>

      {/* Bottom rail: hand of cards, dice, build actions */}
      <footer className="hud-foot night-rail safe-x [--pad-x:0.5rem] min-[360px]:[--pad-x:0.75rem] sm:[--pad-x:1.25rem] relative z-20 min-w-0 shadow-[0_-8px_20px_-8px_rgba(0,0,0,0.8)] pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] md:pt-3 md:pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <div className="hud-foot-stripe absolute inset-x-0 top-0 h-[3px] bg-chakra" aria-hidden="true" />
        <div className="hud-foot-stripe hud-foot-stripe-line absolute inset-x-0 top-[3px] h-px bg-black/70" aria-hidden="true" />
        <div className="hud-foot-grid">
          <div className="hud-hand">
            {isSpectator ? (
              // Spectators hold no cards and cannot act
              <p className="flex items-center gap-2 min-h-[44px] text-[13px] sm:text-[14px] text-paper/80">
                <EyeIcon className="w-5 h-5 text-chakra-light shrink-0" />
                <span>
                  <strong className="text-paper-light">Observando</strong>
                  <span className="hidden min-[400px]:inline"> · no ves las cartas de nadie ni puedes jugar</span>
                </span>
              </p>
            ) : (
              <ResourceBar />
            )}
          </div>
          <div className="hud-dice">
            <DiceRoll />
          </div>
          {!isSpectator && (
            <div className="hud-actions">
              <ActionPanel />
            </div>
          )}
        </div>
      </footer>

      {/* Interactive Modals */}
      <TradeModal
        isOpen={activeModal === 'trade'}
        onClose={() => setActiveModal(null)}
      />

      <DevCardModal
        isOpen={activeModal === 'devCard'}
        onClose={() => setActiveModal(null)}
      />

      <DiscardModal isOpen={activeModal === 'discard'} />

      <StealModal
        isOpen={activeModal === 'steal'}
        onClose={() => setActiveModal(null)}
      />

      {/* «Pacto de paz»: the robber mover's window (kept open while the offer waits) and the target's prompt */}
      <PeacePactModal
        isOpen={!isSpectator && (activeModal === 'peacePact' ||
          (gameState.peacePact?.status === 'pending' && gameState.peacePact.fromId === myPlayerId))}
        onClose={closePactModal}
      />
      <PeacePactPrompt />

      <ProductionModal />

      <EndGameModal
        isOpen={activeModal === 'endGame' && !isSpectator}
        onClose={() => setActiveModal(null)}
      />

      {activeModal === 'roomMenu' && (
        <RoomMenuModal isOpen onClose={() => setActiveModal(null)} />
      )}

      <GameOverModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <GameProvider>
          <GameContent />
          <ToastContainer />
          <PwaLayer />
        </GameProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
