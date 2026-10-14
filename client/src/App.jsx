import { useState } from 'react';
import { SocketProvider } from './context/SocketContext';
import { GameProvider, useGame } from './context/GameContext';
import { PHASE } from './utils/constants';

import { LobbyScreen } from './components/Lobby/LobbyScreen';
import { WaitingRoom } from './components/Lobby/WaitingRoom';
import { HexBoard } from './components/Board/HexBoard';
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
import { GameOverModal } from './components/GameOver/GameOverModal';
import { ProductionModal } from './components/HUD/ProductionModal';
import { EndGameModal } from './components/HUD/EndGameModal';
import { ToastContainer } from './components/Shared/Toast';
import { CloseIcon, ScrollIcon } from './components/Shared/Icons';

function GameContent() {
  const { gameState, activeModal, setActiveModal } = useGame();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // If not joined any room yet
  if (!gameState) {
    return <LobbyScreen />;
  }

  // Pre-game lobby room
  if (gameState.phase === PHASE.LOBBY) {
    return <WaitingRoom />;
  }

  // Active game (Setup, Main, Robber, Game Over)
  return (
    <div className="night-surface relative h-dvh w-screen flex flex-col overflow-hidden text-ink font-sans">
      {/* Top Header */}
      <GameHeader />

      {/* Main Content Area */}
      <div className="relative flex-1 flex overflow-hidden min-h-0">
        {/* Center SVG Board Area */}
        <main className="relative flex-1 h-full w-full flex items-center justify-center overflow-hidden">
          <HexBoard />

          {/* Mobile sidebar toggle button */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden absolute top-3 right-3 z-20 btn paper px-2.5 py-1.5 text-xs border border-ink/70 shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
            aria-expanded={mobileSidebarOpen}
          >
            {mobileSidebarOpen ? <CloseIcon className="w-4 h-4" /> : <ScrollIcon className="w-4 h-4" />}
            <span>{mobileSidebarOpen ? 'Cerrar' : 'Registro'}</span>
          </button>
        </main>

        {/* Mobile scrim */}
        {mobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 top-14 z-20 bg-night-dark/50 animate-fade-in"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Right Sidebar: Standings & Live Log/Chat */}
        <aside
          className={`paper fixed top-14 bottom-0 right-0 z-30 md:static md:inset-auto w-80 max-w-[88vw] flex flex-col border-l-[3px] border-ink shadow-[-10px_0_24px_-10px_rgba(0,0,0,0.7)] transition-transform duration-300 ease-out ${
            mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          }`}
        >
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden absolute top-3 right-3 z-10 p-1.5 rounded-full text-ink-faint hover:text-ink hover:bg-ink/5"
            aria-label="Cerrar"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
          <ScoreBoard />
          <GameLog />
        </aside>
      </div>

      {/* Bottom rail: hand of cards, dice, build actions */}
      <footer className="night-rail relative z-20 shrink-0 shadow-[0_-8px_20px_-8px_rgba(0,0,0,0.8)] px-3 sm:px-5 pt-3.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] md:pt-3 md:pb-2.5">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-chakra" aria-hidden="true" />
        <div className="absolute inset-x-0 top-[3px] h-px bg-black/70" aria-hidden="true" />
        <div className="flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2.5 md:gap-4">
          <div className="flex-1 min-w-0">
            <ResourceBar />
          </div>
          <DiceRoll />
          <div className="w-full md:w-auto overflow-x-auto md:overflow-visible">
            <ActionPanel />
          </div>
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

      <ProductionModal />

      <EndGameModal
        isOpen={activeModal === 'endGame'}
        onClose={() => setActiveModal(null)}
      />

      <GameOverModal />
    </div>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <GameProvider>
        <GameContent />
        <ToastContainer />
      </GameProvider>
    </SocketProvider>
  );
}
