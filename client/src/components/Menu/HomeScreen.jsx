import { Suspense, lazy, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { LobbyScreen } from '../Lobby/LobbyScreen';
import { MainMenu } from './MainMenu';
import { ShopScreen } from './ShopScreen';
import { ProfileScreen } from './ProfileScreen';
import { RankingScreen } from './RankingScreen';
import { LoginModal } from './LoginModal';

// The tutorial (text + 3D lessons) is its own lazy chunk
const TutorialScreen = lazy(() => import('../Tutorial/TutorialScreen'));

/**
 * Everything before a room: the main menu and its screens. `screen` lives in
 * App so leaving a game comes back to the same place.
 */
export function HomeScreen({ screen, onScreen }) {
  const { notice, clearNotice, user } = useAuth();
  const { addToast } = useGame();
  const [loginOpen, setLoginOpen] = useState(false);

  // Message brought back by the Google sign-in redirect
  useEffect(() => {
    if (!notice) return;
    addToast(notice.text, notice.type, 5000);
    clearNotice();
  }, [notice, addToast, clearNotice]);

  const go = (next) => onScreen(next);
  const openLogin = () => setLoginOpen(true);
  const toMenu = () => go('menu');

  let content;
  if (screen === 'play') {
    content = <LobbyScreen onBack={toMenu} />;
  } else if (screen === 'shop') {
    content = <ShopScreen onBack={toMenu} onLogin={openLogin} onProfile={() => go('profile')} />;
  } else if (screen === 'ranking') {
    content = <RankingScreen onBack={toMenu} onLogin={openLogin} onProfile={() => go('profile')} />;
  } else if (screen === 'tutorial') {
    content = (
      <Suspense fallback={<div className="night-surface h-dvh w-full" aria-busy="true" />}>
        <TutorialScreen onBack={toMenu} onPlay={() => go('play')} />
      </Suspense>
    );
  } else if (screen === 'profile') {
    // Re-mounted when the account changes so the form shows the saved profile
    content = <ProfileScreen key={user ? user.id : 'guest'} onBack={toMenu} onLogin={openLogin} onShop={() => go('shop')} />;
  } else {
    content = <MainMenu onNavigate={go} onLogin={openLogin} />;
  }

  return (
    <>
      {content}
      {loginOpen && <LoginModal isOpen onClose={() => setLoginOpen(false)} />}
    </>
  );
}
