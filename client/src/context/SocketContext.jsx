import { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { checkForUpdate } from '../pwa/updateCheck';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const PLAYER_ID_KEY = 'catan_player_id';

// Persistent per-tab player id: survives reloads/reconnects (sessionStorage is per tab,
// so two tabs in the same browser are still two different players).
function getPlayerId(key = PLAYER_ID_KEY) {
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = (globalThis.crypto?.randomUUID?.() || `p-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function resetPlayerId() {
  try {
    sessionStorage.removeItem(PLAYER_ID_KEY);
  } catch {
    // ignore
  }
}

// `idKey`: the admin panel uses its own id so it never takes over a seat
export function SocketProvider({ children, idKey = PLAYER_ID_KEY }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [playerId] = useState(() => getPlayerId(idKey));
  const { user, getSocketToken, currentUserId } = useAuth();
  const tokenRef = useRef(getSocketToken);
  const userIdOfRef = useRef(currentUserId);
  useEffect(() => {
    tokenRef.current = getSocketToken;
    userIdOfRef.current = currentUserId;
  }, [getSocketToken, currentUserId]);
  // Account the server knows this socket by (null = guest)
  const sentUserRef = useRef(null);
  const userId = user ? user.id : null;

  useEffect(() => {
    // VITE_SERVER_URL overrides everything. In dev (vite on :5173) the server
    // runs on :3001 of the same host; in production the server also serves
    // this page, so connect to the same origin (works with https on Render).
    const serverUrl =
      import.meta.env.VITE_SERVER_URL ||
      (import.meta.env.DEV ? `http://${window.location.hostname}:3001` : window.location.origin);

    const socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling'],
      // A logged-in player also sends a short-lived account token (fetched
      // again on every reconnection); guests send only their playerId
      auth: (cb) => {
        tokenRef.current()
          .then((token) => {
            sentUserRef.current = token ? userIdOfRef.current() : null;
            cb(token ? { playerId, token } : { playerId });
          })
          .catch(() => {
            sentUserRef.current = null;
            cb({ playerId });
          });
      },
      // Keep trying: free hosts (Render) can take ~1 min to wake up
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    let connectedBefore = false;
    socketInstance.on('connect', () => {
      console.log('Connected to Catan server, socket ID:', socketInstance.id);
      setConnected(true);
      // Back after a drop: often a deploy restarted the server, so look for
      // the new version right away instead of waiting for the next poll
      if (connectedBefore) checkForUpdate();
      connectedBefore = true;
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from Catan server');
      setConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [playerId]);

  // Signed in / out from the menu: tell the server without reconnecting
  useEffect(() => {
    if (!socket || !connected || sentUserRef.current === userId) return;
    sentUserRef.current = userId;
    (userId ? tokenRef.current() : Promise.resolve(null))
      .then((token) => socket.emit('authenticate', { token }))
      .catch(() => {});
  }, [socket, connected, userId]);

  const value = useMemo(() => ({
    socket,
    connected,
    playerId,
  }), [socket, connected, playerId]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
