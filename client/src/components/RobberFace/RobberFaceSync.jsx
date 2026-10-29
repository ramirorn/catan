import { useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../context/SocketContext';
import { faceKey, getRobberFace, setRobberFace } from './robberFaceStore';

/**
 * Keeps the robber's face of the current room in robberFaceStore: the state
 * only carries its id, and the photo is fetched once per id.
 */
export function RobberFaceSync() {
  const { gameState } = useGame();
  const { socket } = useSocket();
  const roomId = gameState?.roomId ?? null;
  const id = gameState?.robberFace?.id ?? null;
  const key = faceKey(roomId, id);

  useEffect(() => {
    if (!key) {
      setRobberFace(null);
      return undefined;
    }
    const current = getRobberFace();
    if (current?.key === key || !socket) return undefined;
    // Another room's face never shows here, not even while this one loads
    if (current && !current.key.startsWith(`${roomId}:`)) setRobberFace(null);
    let live = true;
    let retry = null;
    const fetchFace = (attempt) => {
      socket.timeout(10000).emit('getRobberFace', { id }, (err, res) => {
        if (!live) return;
        if (!err && res?.success && res.face) {
          setRobberFace({ ...res.face, key });
        } else if (err && attempt < 3) {
          retry = setTimeout(() => fetchFace(attempt + 1), 2000 * (attempt + 1));
        }
      });
    };
    fetchFace(0);
    return () => {
      live = false;
      clearTimeout(retry);
    };
  }, [key, id, roomId, socket]);

  return null;
}
