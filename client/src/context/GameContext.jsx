import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { whenStageIdle } from '../components/Effects/fxSignal';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { PHASE, RESOURCE_NAMES } from '../utils/constants';
import { loadAvatarId, saveAvatarId, isAvatarId } from '../utils/avatars';

const GameContext = createContext(null);
const NO_SPECTATORS = [];

export function GameProvider({ children }) {
  const { socket, connected, playerId } = useSocket();
  const [gameState, setGameState] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('catan_player_name') || '');
  // Profile avatar (index); remembered in localStorage, random the first time
  const [avatarId, setAvatarIdState] = useState(loadAvatarId);
  const avatarSendRef = useRef(null);
  const [buildMode, setBuildMode] = useState(null); // 'road' | 'settlement' | 'city' | null
  const [activeModal, setActiveModal] = useState(null); // 'trade' | 'bankTrade' | 'devCard' | 'discard' | 'steal' | null
  const [toasts, setToasts] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [robberVictims, setRobberVictims] = useState([]);
  const [isRolling, setIsRolling] = useState(false);
  // Server clock minus local clock (ms), so countdowns follow the server's deadline
  const [serverOffset, setServerOffset] = useState(0);
  // Ryō earned in the game that just ended (logged-in players): { coins, total, reason }
  const [coinsAward, setCoinsAward] = useState(null);
  const { user, applyCoins } = useAuth();

  // A logged-in player's profile fills in the name and avatar used in rooms
  const profileName = user ? user.displayName : null;
  const profileAvatar = user ? user.avatarId : null;
  useEffect(() => {
    if (profileName) {
      setPlayerName(profileName);
      try {
        localStorage.setItem('catan_player_name', profileName);
      } catch {
        // storage blocked
      }
    }
    if (isAvatarId(profileAvatar)) {
      setAvatarIdState(profileAvatar);
      saveAvatarId(profileAvatar);
    }
  }, [profileName, profileAvatar]);

  const addToast = useCallback((text, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  // Back to the main menu (left the room, kicked, room closed)
  const resetToMenu = useCallback(() => {
    setGameState(null);
    setRoomId('');
    setChatMessages([]);
    setBuildMode(null);
    setActiveModal(null);
    setRobberVictims([]);
    setCoinsAward(null);
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

    // Only the spectator list changed (someone started / stopped watching)
    const handleRoomSpectators = ({ roomId: rid, spectators } = {}) => {
      if (!Array.isArray(spectators)) return;
      setGameState((prev) => (prev && (!rid || prev.roomId === rid) ? { ...prev, spectators } : prev));
    };

    // The host removed us, or the room no longer exists
    const handleKicked = ({ message } = {}) => {
      resetToMenu();
      addToast(message || 'El anfitrión te expulsó de la sala', 'error', 6000);
    };
    const handleRoomClosed = ({ message } = {}) => {
      resetToMenu();
      addToast(message || 'La sala se cerró', 'info', 5000);
    };

    socket.on('gameState', handleGameState);
    socket.on('chatMessage', handleChatMessage);
    socket.on('chatHistory', handleChatHistory);
    socket.on('roomSpectators', handleRoomSpectators);
    socket.on('kicked', handleKicked);
    // Ryō paid when the game ended (only sent to logged-in players)
    const handleCoinsAwarded = ({ coins, total, won, reason } = {}) => {
      const paidTotal = Number.isInteger(total) ? total : null;
      setCoinsAward({ coins: Number(coins) || 0, total: paidTotal, reason: reason || null });
      if (paidTotal !== null) applyCoins(paidTotal, won === true);
    };

    socket.on('roomClosed', handleRoomClosed);
    socket.on('coinsAwarded', handleCoinsAwarded);

    return () => {
      socket.off('gameState', handleGameState);
      socket.off('chatMessage', handleChatMessage);
      socket.off('chatHistory', handleChatHistory);
      socket.off('roomSpectators', handleRoomSpectators);
      socket.off('kicked', handleKicked);
      socket.off('roomClosed', handleRoomClosed);
      socket.off('coinsAwarded', handleCoinsAwarded);
    };
  }, [socket, resetToMenu, addToast, applyCoins]);

  // Persistent player id (not socket.id, which changes on every reconnect)
  const myPlayerId = playerId;
  const myPlayer = gameState?.players ? gameState.players[myPlayerId] : null;
  // Watching a room (no seat): the server sends the public view only
  const isSpectator = gameState?.spectator === true;
  const spectators = gameState?.spectators || NO_SPECTATORS;
  const hostId = gameState?.hostId ?? gameState?.playerOrder?.[0] ?? null;
  const isHost = !isSpectator && !!myPlayerId && hostId === myPlayerId;
  const isMyTurn = !isSpectator && gameState?.currentPlayerId === myPlayerId;
  // Who may place pieces on the board right now: only the turn player
  // (building happens in your own turn, after rolling the dice)
  const canActOnBoard = isMyTurn;

  // Auto show discard modal if player must discard
  useEffect(() => {
    if (gameState?.phase === PHASE.ROBBER_DISCARD) {
      if (gameState.mustDiscard?.includes(myPlayerId) && !gameState.discardedPlayers?.includes(myPlayerId)) {
        setActiveModal('discard');
      } else {
        if (activeModal === 'discard') setActiveModal(null);
      }
    } else if (activeModal === 'discard') {
      // Discard was resolved elsewhere (time ran out, another tab…)
      setActiveModal(null);
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
  // Only pop the offer up when I can actually pay what it asks of me. Otherwise
  // it just waits inside the Comercio window (where I can counter-offer). If I
  // get the cards while it is still pending, it pops up then — once per offer.
  const myRes = myPlayer?.resources;
  const canPayActiveTrade = !!activeTradeId && !!myRes &&
    Object.entries(gameState?.activeTrade?.requesting || {}).every(([r, n]) => (myRes[r] || 0) >= n);
  const autoOpenedTradeRef = useRef(null);
  const notifiedTradeRef = useRef(null);
  useEffect(() => {
    if (
      !activeTradeId ||
      isSpectator ||
      activeTradeProposer === myPlayerId ||
      myTradeResponse ||
      autoOpenedTradeRef.current === activeTradeId
    ) return;
    if (!canPayActiveTrade) {
      if (notifiedTradeRef.current !== activeTradeId) {
        notifiedTradeRef.current = activeTradeId; // one quiet heads-up per offer
        const who = gameState?.activeTrade?.proposerName || 'Un ninja';
        addToast(`${who} propone un comercio, pero no tienes lo que pide. Puedes contraofertar en Comercio.`, 'info', 5000);
      }
      return;
    }
    if (activeModal === null) {
      autoOpenedTradeRef.current = activeTradeId; // open once per offer, so it can be dismissed
      setActiveModal('trade');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTradeId, activeTradeProposer, myTradeResponse, myPlayerId, activeModal, isSpectator, canPayActiveTrade]);

  // The offer went away (cancelled, traded with someone else) or my turn ended:
  // with nothing to answer and no trading of my own the Comercio window would be
  // left empty, so close it
  const canTradeNow = isMyTurn && gameState?.phase === PHASE.MAIN;
  useEffect(() => {
    if (activeTradeId === null && !canTradeNow) {
      setActiveModal((m) => (m === 'trade' ? null : m));
    }
  }, [activeTradeId, canTradeNow]);

  // Robber: the victim learns what was taken, the thief what they got.
  // Everyone else only reads «le robó una carta» in the chronicle.
  const stealId = gameState?.lastSteal?.id ?? null;
  const seenStealRef = useRef(undefined);
  useEffect(() => {
    if (seenStealRef.current === undefined) {
      seenStealRef.current = stealId; // a robbery from before we joined
      return;
    }
    if (stealId === null || stealId === seenStealRef.current) return;
    seenStealRef.current = stealId;
    const steal = gameState?.lastSteal;
    if (!steal?.resource) return;
    const res = RESOURCE_NAMES[steal.resource] || steal.resource;
    const thief = gameState?.players?.[steal.thiefId]?.name || 'Un ninja';
    const victim = gameState?.players?.[steal.victimId]?.name || 'un ninja';
    let message = null;
    if (steal.victimId === myPlayerId) {
      const who = steal.source === 'knight' ? `El Caballero de ${thief}` : `El renegado de ${thief}`;
      message = [`${who} te robó 1 ${res}`, 'error', 6000];
    } else if (steal.thiefId === myPlayerId) {
      message = [`Le robaste 1 ${res} a ${victim}`, 'success', 5000];
    }
    if (!message) return;
    // Tell it after the dice / robber / steal animations, so it isn't spoiled
    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      addToast(...message);
    };
    let cancelWait = () => {};
    const start = setTimeout(() => {
      cancelWait = whenStageIdle(show);
    }, 150);
    const cap = setTimeout(show, 7000);
    return () => {
      clearTimeout(start);
      clearTimeout(cap);
      cancelWait();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stealId]);

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

    socket.emit('createRoom', { playerName: name, boardType, ...settings, avatarId }, (res) => {
      if (res.success) {
        setRoomId(res.roomId);
        setGameState(res.state);
        setChatMessages([]);
        addToast(`¡Sala ${res.roomId} creada con éxito!`, 'success');
      } else {
        addToast(res.error || 'Error al crear la sala', 'error');
      }
    });
  }, [socket, connected, addToast, avatarId]);

  const joinRoom = useCallback((targetRoomId, name) => {
    if (!socket || !connected) {
      addToast('No hay conexión con el servidor', 'error');
      return;
    }
    const cleanRoomId = targetRoomId.trim().toUpperCase();
    localStorage.setItem('catan_player_name', name);
    setPlayerName(name);

    socket.emit('joinRoom', { roomId: cleanRoomId, playerName: name, avatarId }, (res) => {
      if (res.success) {
        setRoomId(cleanRoomId);
        addToast(`¡Te has unido a la sala ${cleanRoomId}!`, 'success');
      } else {
        addToast(res.error || 'Error al unirse a la sala', 'error');
      }
    });
  }, [socket, connected, addToast, avatarId]);

  // Watch a room (waiting or in progress) without a seat
  const spectateRoom = useCallback((targetRoomId, name) => {
    if (!socket || !connected) {
      addToast('No hay conexión con el servidor', 'error');
      return;
    }
    const cleanRoomId = targetRoomId.trim().toUpperCase();
    localStorage.setItem('catan_player_name', name);
    setPlayerName(name);
    socket.emit('spectateRoom', { roomId: cleanRoomId, playerName: name, avatarId }, (res) => {
      if (res?.success) {
        setRoomId(cleanRoomId);
        addToast(`Observando la sala ${cleanRoomId}`, 'success');
      } else {
        addToast(res?.error || 'No se pudo observar la sala', 'error');
      }
    });
  }, [socket, connected, addToast, avatarId]);

  // Change the avatar: saved at once; inside a room the server is told after
  // a short pause (quick arrow-key browsing sends a single update)
  const setAvatarId = useCallback((id) => {
    if (!isAvatarId(id)) return;
    setAvatarIdState(id);
    saveAvatarId(id);
    if (avatarSendRef.current) clearTimeout(avatarSendRef.current);
    if (!socket || !roomId) return;
    avatarSendRef.current = setTimeout(() => {
      avatarSendRef.current = null;
      socket.emit('setAvatar', { avatarId: id }, (res) => {
        if (res && res.success === false && res.error) addToast(res.error, 'error');
      });
    }, 350);
  }, [socket, roomId, addToast]);

  useEffect(() => () => {
    if (avatarSendRef.current) clearTimeout(avatarSendRef.current);
  }, []);

  // Leave the room / game (players and spectators) and go back to the menu
  const leaveRoom = useCallback(() => {
    if (!socket) return;
    socket.emit('leaveRoom', {}, (res) => {
      if (res?.success === false) {
        addToast(res.error || 'No se pudo salir de la sala', 'error');
        return;
      }
      resetToMenu();
      addToast('Volviste al menú principal', 'info');
    });
  }, [socket, addToast, resetToMenu]);

  // Host only (the server checks it): remove a player or a spectator
  const kickPlayer = useCallback((targetId) => {
    if (!socket) return;
    socket.emit('kickPlayer', { targetId }, (res) => handleCallback(res, 'Expulsado de la sala'));
  }, [socket, handleCallback]);

  // Host: change the room rules before starting (victory points, turn time)
  const updateRoomSettings = useCallback((settings) => {
    if (!socket) return;
    socket.emit('updateRoomSettings', settings, (res) => handleCallback(res));
  }, [socket, handleCallback]);

  // Host: board theme of the room (one of the boards their account owns)
  const setBoardTheme = useCallback((themeId) => {
    if (!socket) return;
    socket.emit('setBoardTheme', { themeId }, (res) => handleCallback(res));
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
          // «Le robaste 1 …» arrives with the new state (lastSteal)
        } else if (res.desert) {
          addToast('El renegado se esconde en el desierto: no roba a nadie.', 'info');
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
        // The stolen resource is announced from lastSteal
        setActiveModal(null);
        setRobberVictims([]);
      } else {
        handleCallback(res);
      }
    });
  }, [socket, handleCallback]);

  // «Pacto de paz»: the robber mover offers it, the target answers
  const offerPeacePact = useCallback((targetId, request) => {
    if (!socket) return;
    socket.emit('offerPeacePact', { targetId, request }, (res) => handleCallback(res));
  }, [socket, handleCallback]);

  const respondPeacePact = useCallback((accept) => {
    if (!socket) return;
    socket.emit('respondPeacePact', { accept }, (res) => handleCallback(res, res?.status === 'accepted' ? 'Pacto de paz firmado' : null));
  }, [socket, handleCallback]);

  const cancelPeacePact = useCallback(() => {
    if (!socket) return;
    socket.emit('cancelPeacePact', {}, (res) => handleCallback(res));
  }, [socket, handleCallback]);

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

  // The phase the button was pressed in travels along, so a stale tap (e.g.
  // «Terminar construcción» landing after the next turn began) is rejected
  const phaseRef = useRef(null);
  const currentPhase = gameState?.phase ?? null;
  useEffect(() => {
    phaseRef.current = currentPhase;
  }, [currentPhase]);
  const endTurn = useCallback(() => {
    if (!socket) return;
    setBuildMode(null);
    setActiveModal(null);
    socket.emit('endTurn', { expectPhase: phaseRef.current }, (res) => handleCallback(res));
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
    avatarId,
    setAvatarId,
    myPlayerId,
    myPlayer,
    isMyTurn,
    isSpectator,
    spectators,
    hostId,
    isHost,
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
    coinsAward,
    // Actions
    createRoom,
    updateRoomSettings,
    setBoardTheme,
    joinRoom,
    spectateRoom,
    leaveRoom,
    kickPlayer,
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
    offerPeacePact,
    respondPeacePact,
    cancelPeacePact,
    bankTrade,
    proposeTrade,
    respondToTrade,
    acceptTrade,
    cancelTrade,
    endTurn,
    voteEndGame,
    sendChatMessage,
  }), [
    gameState, roomId, playerName, avatarId, setAvatarId, myPlayerId, myPlayer, isMyTurn,
    isSpectator, spectators, hostId, isHost, spectateRoom, leaveRoom, kickPlayer,
    canActOnBoard,
    buildMode, activeModal, toasts, addToast, chatMessages, robberVictims, isRolling,
    serverOffset, coinsAward, updateRoomSettings, setBoardTheme,
    createRoom, joinRoom, startGame, rollDice, setupPlaceSettlement, setupPlaceRoad,
    buildRoad, buildSettlement, buildCity, buyDevCard, playDevCard, discardCards,
    moveRobber, stealCard, offerPeacePact, respondPeacePact, cancelPeacePact, bankTrade, proposeTrade, respondToTrade, acceptTrade,
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
