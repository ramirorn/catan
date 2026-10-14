import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const PLAYER_ID_KEY = 'catan_player_id';

// Persistent per-tab player id: survives reloads/reconnects (sessionStorage is per tab,
// so two tabs in the same browser are still two different players).
function getPlayerId() {
  try {
    let id = sessionStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = (globalThis.crypto?.randomUUID?.() || `p-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      sessionStorage.setItem(PLAYER_ID_KEY, id);
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

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [playerId] = useState(getPlayerId);

  useEffect(() => {
    // VITE_SERVER_URL overrides everything. In dev (vite on :5173) the server
    // runs on :3001 of the same host; in production the server also serves
    // this page, so connect to the same origin (works with https on Render).
    const serverUrl =
      import.meta.env.VITE_SERVER_URL ||
      (import.meta.env.DEV ? `http://${window.location.hostname}:3001` : window.location.origin);

    const socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling'],
      auth: { playerId },
      // Keep trying: free hosts (Render) can take ~1 min to wake up
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('Connected to Catan server, socket ID:', socketInstance.id);
      setConnected(true);
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
