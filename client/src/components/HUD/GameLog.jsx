import { useState, useRef, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { pieceColor, shade } from '../../utils/theme';
import { ScrollIcon, ChatIcon, ChevronDownIcon } from '../Shared/Icons';
import { useLogExpanded, setLogExpanded } from './logLayout';

export function GameLog() {
  const { gameState, chatMessages, sendChatMessage } = useGame();
  const [activeTab, setActiveTab] = useState('log');
  const [text, setText] = useState('');
  const scrollRef = useRef(null);
  const expanded = useLogExpanded();

  const logs = gameState?.gameLog || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, chatMessages, activeTab, expanded]);

  // iOS: once the keyboard is up, bring the box into view; on close, undo any
  // page shift Safari left behind
  const handleChatFocus = (e) => {
    const input = e.currentTarget;
    setTimeout(() => input.scrollIntoView({ block: 'nearest' }), 320);
  };
  const handleChatBlur = () => {
    if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendChatMessage(text.trim());
    setText('');
  };

  const tabClass = (isActive) =>
    `flex-1 flex items-center justify-center gap-1.5 min-h-[42px] py-2 text-[13px] font-bold border-b-2 transition-colors cursor-pointer ${
      isActive ? 'border-chakra text-ink' : 'border-transparent text-ink-faint hover:text-ink-soft'
    }`;

  return (
    <div className="hud-log flex flex-col flex-1 overflow-hidden min-h-0 border-t border-paper-edge">
      {/* Tab Header */}
      <div className="flex px-3 shrink-0 border-b border-ink/15" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'log'}
          onClick={() => setActiveTab('log')}
          className={tabClass(activeTab === 'log')}
        >
          <ScrollIcon className="w-4 h-4" />
          <span>Registro</span>
          <span className="font-normal text-ink-faint text-[11px]">{logs.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
          className={tabClass(activeTab === 'chat')}
        >
          <ChatIcon className="w-4 h-4" />
          <span>Chat</span>
          <span className="font-normal text-ink-faint text-[11px]">{chatMessages.length}</span>
        </button>
        {/* Enlarge the log / chat over the standings (they shrink to a strip) */}
        <button
          type="button"
          onClick={() => setLogExpanded(!expanded)}
          className="shrink-0 w-10 flex items-center justify-center text-ink-faint hover:text-shu cursor-pointer border-b-2 border-transparent"
          aria-pressed={expanded}
          title={expanded ? 'Reducir y ver la clasificación' : 'Ampliar registro y chat'}
          aria-label={expanded ? 'Reducir y ver la clasificación' : 'Ampliar registro y chat'}
        >
          <ChevronDownIcon className={`w-4 h-4 transition-transform ${expanded ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {/* Message Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 text-[13px] leading-snug">
        {activeTab === 'log' ? (
          logs.length === 0 ? (
            <p className="text-center italic text-ink-faint py-6">
              La misión ha comenzado. Aquí quedará escrito cada suceso.
            </p>
          ) : (
            <ol>
              {logs.map((entry, idx) => (
                <li
                  key={idx}
                  className={`py-1.5 border-b border-dotted border-ink/20 last:border-b-0 ${
                    idx === logs.length - 1 ? 'text-ink font-semibold' : 'text-ink-soft'
                  }`}
                >
                  {entry.message}
                </li>
              ))}
            </ol>
          )
        ) : chatMessages.length === 0 ? (
          <p className="text-center italic text-ink-faint py-6">
            No hay mensajes aún. ¡Envía un saludo a los demás ninjas!
          </p>
        ) : (
          <ol>
            {chatMessages.map((msg, idx) => (
              <li key={msg.id ?? idx} className="py-1.5 border-b border-dotted border-ink/20 last:border-b-0 break-words">
                <span className="font-extrabold" style={{ color: shade(pieceColor(msg.playerColor), -0.15) }}>
                  {msg.playerName}:
                </span>{' '}
                <span className="text-ink">{msg.message}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Chat input form */}
      {activeTab === 'chat' && (
        <form
          onSubmit={handleSendChat}
          className="flex items-center gap-2 px-3 py-2.5 compact:pb-[max(0.6rem,env(safe-area-inset-bottom))] border-t border-paper-edge shrink-0 bg-paper-deep/40"
        >
          <input
            type="text"
            className="field !py-1.5 !text-[13px] coarse:!text-[16px] flex-1 min-w-0"
            placeholder="Escribe un mensaje a los demás ninjas…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={handleChatFocus}
            onBlur={handleChatBlur}
            maxLength={500}
            enterKeyHint="send"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary min-h-[40px] px-3 py-1.5 text-[13px] shrink-0">
            Enviar
          </button>
        </form>
      )}
    </div>
  );
}
