import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSocket } from './SocketContext';
import { PHASE } from '../utils/constants';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { socket, connected, playerId } = useSocket();
  const [gameState, setGameState] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('catan_player_name') || '');
  const [buildMode, setBuildMode] = useState(null); // 'road' | 'settlement' | 'city' | null
  const [activeModal, setActiveModal] = useState(null); // 'trade' | 'bankTrade' | 'devCard' | 'discard' | 'steal' | null
  const [toasts, setToasts] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [robberVictims, setRobberVictims] = useState([]);
  const [isRolling, setIsRolling] = useState(false);
  // Server clock minus local clock (ms), so countdowns follow the server's deadline
  const [serverOffset, setServerOffset] = useState(0);

  const addToast = useCallback((text, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // Listen to socket events
  useEffect(() => {
    if (!socket) return;

    const handleGameState = (state) => {
      setGameState(state);
      if (state.roomId) setRoomId(state.roomId);
      if (typeof state.serverNow === 'number') setServerOffset(state.serverNow - Date.now());
    };

    const handleChatMessage = (msg) => {
      setChatMessages((prev) => (
        msg.id != null && prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      ));
    };

    // Full chat history of the room (sent on join / reconnect / page reload)
    const handleChatHistory = ({ messages } = {}) => {
      if (!Array.isArray(messages)) return;
      setChatMessages((prev) => {
        const ids = new Set(messages.map((m) => m.id));
        // Keep live messages that arrived after the history snapshot
        const newer = prev.filter((m) => m.id != null && !ids.has(m.id) && m.id > (messages.at(-1)?.id ?? 0));
        return [...messages, ...newer];
      });
    };

    socket.on('gameState', handleGameState);
    socket.on('chatMessage', handleChatMessage);
    socket.on('chatHistory', handleChatHistory);

    return () => {
      socket.off('gameState', handleGameState);
      socket.off('chatMessage', handleChatMessage);
      socket.off('chatHistory', handleChatHistory);
    };
  }, [socket]);

  // Persistent player id (not socket.id, which changes on every reconnect)
  const myPlayerId = playerId;
  const myPlayer = gameState?.players ? gameState.players[myPlayerId] : null;
  const isMyTurn = gameState?.currentPlayerId === myPlayerId;
  // 5–6 player extension: after each turn the others build one by one
  const isSpecialBuild = gameState?.phase === PHASE.SPECIAL_BUILD;
  const isMySpecialBuild = isSpecialBuild && gameState?.specialBuilderId === myPlayerId;
  // Who may place pieces on the board right now
  const canActOnBoard = isSpecialBuild ? isMySpecialBuild : isMyTurn;

  // Auto show discard modal if player must discard
  useEffect(() => {
    if (gameState?.phase === PHASE.ROBBER_DISCARD) {
      if (gameState.mustDiscard?.includes(myPlayerId) && !gameState.discardedPlayers?.includes(myPlayerId)) {
        setActiveModal('discard');
      } else {
        if (activeModal === 'discard') setActiveModal(null);
      }
    }
  }, [gameState?.phase, gameState?.mustDiscard, gameState?.discardedPlayers, myPlayerId, activeModal]);

  // Steal modal is driven by server state (works after reconnect too)
  useEffect(() => {
    if (gameState?.phase === PHASE.ROBBER_STEAL && isMyTurn && gameState.stealTargets?.length) {
      setRobberVictims(gameState.stealTargets);
      setActiveModal('steal');
    } else if (activeModal === 'steal') {
      setActiveModal(null);
      setRobberVictims([]);
    }
  }, [gameState?.phase, gameState?.stealTargets, isMyTurn, activeModal]);

  // Other players must see incoming trade offers (their Trade button is disabled off-turn)
  const activeTradeId = gameState?.activeTrade?.status === 'pending' ? gameState.activeTrade.id : null;
  const activeTradeProposer = gameState?.activeTrade?.proposerId;
  const myTradeResponse = gameState?.activeTrade?.responses?.[myPlayerId];
  const autoOpenedTradeRef = useRef(null);
  useEffect(() => {
    if (
      activeTradeId &&
      autoOpenedTradeRef.current !== activeTradeId &&
      activeTradeProposer !== myPlayerId &&
      !myTradeResponse &&
      activeModal === null
    ) {
      autoOpenedTradeRef.current = activeTradeId; // open once per offer, so it can be dismissed
      setActiveModal('trade');
    }
  }, [activeTradeId, activeTradeProposer, myTradeResponse, myPlayerId, activeModal]);

  // Proposer side: someone accepted our offer and the swap already happened
  const completedTradeId = gameState?.lastCompletedTrade?.id ?? null;
  const completedTradeProposer = gameState?.lastCompletedTrade?.proposerId;
  const completedTradeAccepter = gameState?.lastCompletedTrade?.accepterId;
  const seenCompletedTradeRef = useRef(undefined);
  useEffect(() => {
    if (seenCompletedTradeRef.current === undefined) {
      seenCompletedTradeRef.current = completedTradeId; // ignore trades from before we joined
      return;
    }
    if (completedTradeId === null || completedTradeId === seenCompletedTradeRef.current) return;
    seenCompletedTradeRef.current = completedTradeId;
    // Normal offer: tell the proposer. Counter-offer: the proposer accepted it, tell the counterer.
    const viaCounter = gameState?.lastCompletedTrade?.viaCounter;
    const notifyId = viaCounter ? completedTradeAccepter : completedTradeProposer;
    if (notifyId !== myPlayerId) return;
    const otherName = gameState?.players?.[viaCounter ? completedTradeProposer : completedTradeAccepter]?.name || 'Un ninja';
    addToast(
      viaCounter ? `${otherName} aceptó tu contraoferta. ¡Intercambio hecho!` : `${otherName} aceptó tu comercio. ¡Intercambio hecho!`,
      'success'
    );
    setActiveModal((m) => (m === 'trade' ? null : m));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedTradeId]);

  // Let everyone know when someone asks to end the game
  const endVoteCount = gameState?.endVotes?.length ?? 0;
  const prevEndVoteCount = useRef(endVoteCount);
  useEffect(() => {
    const prev = prevEndVoteCount.current;
    prevEndVoteCount.current = endVoteCount;
    if (endVoteCount > prev && !gameState?.endVotes?.includes(myPlayerId)) {
      const total = gameState?.playerOrder?.length || 0;
      addToast(`Votación para terminar la partida: ${endVoteCount}/${total}. Usa «Terminar» arriba a la derecha.`, 'info');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endVoteCount]);

  // Handle Action responses helper
  const handleCallback = useCallback((res, successMessage = null) => {
    if (!res) return;
    if (res.success) {
      if (successMessage) addToast(successMessage, 'success');
    } else if (res.error) {
      addToast(res.error, 'error');
    }
  }, [addToast]);

  // Socket Actions
  const createRoom = useCallback((name, boardType = 'standard', settings = {}) => {
    if (!socket || !connected) {
      addToast('No hay conexión con el servidor', 'error');
      return;
    }
    localStorage.setItem('catan_player_name', name);
    setPlayerName(name);

    socket.emit('createRoom', { playerName: name, boardType, ...settings }, (res) => {
      if (res.success) {
        setRoomId(res.roomId);
        setGameState(res.state);
        setChatMessages([]);
        addToast(`¡Sala ${res.roomId} creada con éxito!`, 'success');
      } else {
        addToast(res.error || 'Error al crear la sala', 'error');
      }
    });
  }, [socket, connected, addToast]);

  const joinRoom = useCallback((targetRoomId, name) => {
    if (!socket || !connected) {
      addToast('No hay conexión con el servidor', 'error');
      return;
    }
    const cleanRoomId = targetRoomId.trim().toUpperCase();
    localStorage.setItem('catan_player_name', name);
    setPlayerName(name);

    socket.emit('joinRoom', { roomId: cleanRoomId, playerName: name }, (res) => {
      if (res.success) {
        setRoomId(cleanRoomId);
        addToast(`¡Te has unido a la sala ${cleanRoomId}!`, 'success');
      } else {
        addToast(res.error || 'Error al unirse a la sala', 'error');
      }
    });
  }, [socket, connected, addToast]);

  // Host: change the room rules before starting (victory points, turn time)
  const updateRoomSettings = useCallback((settings) => {
    if (!socket) return;
    socket.emit('updateRoomSettings', settings, (res) => handleCallback(res));
  }, [socket, handleCallback]);

  const startGame = useCallback(() => {
    if (!socket) return;
    socket.emit('startGame', {}, (res) => handleCallback(res, '¡Partida iniciada!'));
  }, [socket, handleCallback]);

  const rollDice = useCallback(() => {
    if (!socket) return;
    setIsRolling(true);
    socket.emit('rollDice', {}, (res) => {
      setIsRolling(false);
      handleCallback(res);
    });
  }, [socket, handleCallback]);

  const setupPlaceSettlement = useCallback((vertexId) => {
    if (!socket) return;
    socket.emit('setupPlaceSettlement', { vertexId }, (res) => handleCallback(res, '¡Poblado colocado!'));
  }, [socket, handleCallback]);

  const setupPlaceRoad = useCallback((edgeId) => {
    if (!socket) return;
    socket.emit('setupPlaceRoad', { edgeId }, (res) => handleCallback(res, '¡Camino colocado!'));
  }, [socket, handleCallback]);

  const buildRoad = useCallback((edgeId) => {
    if (!socket) return;
    socket.emit('buildRoad', { edgeId }, (res) => {
      handleCallback(res, '¡Camino construido!');
      if (res.success) setBuildMode(null);
    });
  }, [socket, handleCallback]);

  const buildSettlement = useCallback((vertexId) => {
    if (!socket) return;
    socket.emit('buildSettlement', { vertexId }, (res) => {
      handleCallback(res, '¡Poblado construido!');
      if (res.success) setBuildMode(null);
    });
  }, [socket, handleCallback]);

  const buildCity = useCallback((vertexId) => {
    if (!socket) return;
    socket.emit('buildCity', { vertexId }, (res) => {
      handleCallback(res, '¡Mejorado a Ciudad (+2 PV)!');
      if (res.success) setBuildMode(null);
    });
  }, [socket, handleCallback]);

  const buyDevCard = useCallback(() => {
    if (!socket) return;
    socket.emit('buyDevCard', {}, (res) => handleCallback(res, '¡Compraste una Carta de Desarrollo!'));
  }, [socket, handleCallback]);

  const playDevCard = useCallback((cardType, params = {}) => {
    if (!socket) return;
    socket.emit('playDevCard', { cardType, params }, (res) => {
      handleCallback(res, '¡Carta de desarrollo jugada!');
      if (res.success) setActiveModal(null);
    });
  }, [socket, handleCallback]);

  const discardCards = useCallback((cards) => {
    if (!socket) return;
    socket.emit('discardCards', { cards }, (res) => {
      handleCallback(res, 'Cartas descartadas correctamente.');
      if (res.success) setActiveModal(null);
    });
  }, [socket, handleCallback]);

  const moveRobber = useCallback((hexId) => {
    if (!socket) return;
    socket.emit('moveRobber', { hexId }, (res) => {
      if (res.success) {
        if (res.stealTargets && res.stealTargets.length > 0) {
          // Server returns [{ id, name }]; the modal works with player ids
          setRobberVictims(res.stealTargets.map((t) => t.id));
          setActiveModal('steal');
        } else if (res.fromPlayer) {
          addToast('Ladrón reubicado. Robaste 1 carta.', 'success');
        } else {
          addToast('Ladrón reubicado. No hay colonos para robar.', 'info');
        }
      } else {
        handleCallback(res);
      }
    });
  }, [socket, handleCallback, addToast]);

  const stealCard = useCallback((victimId) => {
    if (!socket) return;
    socket.emit('stealCard', { victimId }, (res) => {
      if (res.success) {
        addToast(res.message || '¡Recurso saqueado con éxito!', 'success');
        setActiveModal(null);
        setRobberVictims([]);
      } else {
        handleCallback(res);
      }
    });
  }, [socket, handleCallback, addToast]);

  const bankTrade = useCallback((give, receive) => {
    if (!socket) return;
    socket.emit('bankTrade', { give, receive }, (res) => {
      handleCallback(res, '¡Intercambio marítimo realizado con éxito!');
      if (res.success) setActiveModal(null);
    });
  }, [socket, handleCallback]);

  const proposeTrade = useCallback((offering, requesting) => {
    if (!socket) return;
    socket.emit('proposeTrade', { offering, requesting }, (res) => {
      handleCallback(res, '¡Propuesta de comercio enviada a los colonos!');
    });
  }, [socket, handleCallback]);

  const respondToTrade = useCallback((response, counterOffer = null) => {
    if (!socket) return;
    socket.emit('respondToTrade', { response, counterOffer }, (res) => {
      handleCallback(res, res?.executed ? '¡Comercio completado!' : response === 'counter' ? 'Contraoferta enviada' : null);
      // Done with this offer (traded or turned down): close the window
      if (res?.executed || (res?.success && response === 'reject')) setActiveModal(null);
    });
  }, [socket, handleCallback]);

  const acceptTrade = useCallback((accepterId) => {
    if (!socket) return;
    socket.emit('acceptTrade', { accepterId }, (res) => {
      handleCallback(res, '¡Comercio completado con éxito!');
      if (res.success) setActiveModal(null);
    });
  }, [socket, handleCallback]);

  const cancelTrade = useCallback(() => {
    if (!socket) return;
    socket.emit('cancelTrade', {}, (res) => {
      handleCallback(res, 'Propuesta de comercio cancelada');
      setActiveModal(null);
    });
  }, [socket, handleCallback]);

  const voteEndGame = useCallback((vote) => {
    if (!socket) return;
    socket.emit('voteEndGame', { vote }, (res) => {
      handleCallback(res, res?.ended ? null : vote ? 'Votaste terminar la partida' : 'Retiraste tu voto');
      if (res?.success) setActiveModal(null);
    });
  }, [socket, handleCallback]);

  const endTurn = useCallback(() => {
    if (!socket) return;
    setBuildMode(null);
    setActiveModal(null);
    socket.emit('endTurn', {}, (res) => handleCallback(res));
  }, [socket, handleCallback]);

  const sendChatMessage = useCallback((message) => {
    if (!socket || !message.trim()) return;
    socket.emit('chatMessage', { message }, (res) => {
      if (res && res.success === false && res.error) addToast(res.error, 'error');
    });
  }, [socket, addToast]);

  const value = useMemo(() => ({
    gameState,
    roomId,
    playerName,
    setPlayerName,
    myPlayerId,
    myPlayer,
    isMyTurn,
    isSpecialBuild,
    isMySpecialBuild,
    canActOnBoard,
    buildMode,
    setBuildMode,
    activeModal,
    setActiveModal,
    toasts,
    addToast,
    chatMessages,
    robberVictims,
    isRolling,
    serverOffset,
    // Actions
    createRoom,
    updateRoomSettings,
    joinRoom,
    startGame,
    rollDice,
    setupPlaceSettlement,
    setupPlaceRoad,
    buildRoad,
    buildSettlement,
    buildCity,
    buyDevCard,
    playDevCard,
    discardCards,
    moveRobber,
    stealCard,
    bankTrade,
    proposeTrade,
    respondToTrade,
    acceptTrade,
    cancelTrade,
    endTurn,
    voteEndGame,
    sendChatMessage,
  }), [
    gameState, roomId, playerName, myPlayerId, myPlayer, isMyTurn,
    isSpecialBuild, isMySpecialBuild, canActOnBoard,
    buildMode, activeModal, toasts, addToast, chatMessages, robberVictims, isRolling,
    serverOffset, updateRoomSettings,
    createRoom, joinRoom, startGame, rollDice, setupPlaceSettlement, setupPlaceRoad,
    buildRoad, buildSettlement, buildCity, buyDevCard, playDevCard, discardCards,
    moveRobber, stealCard, bankTrade, proposeTrade, respondToTrade, acceptTrade,
    cancelTrade, endTurn, voteEndGame, sendChatMessage
  ]);

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
