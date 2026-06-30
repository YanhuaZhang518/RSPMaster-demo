import { useEffect, useState } from 'react';
import type { RoomState } from '../types/game';
import { subscribeRoom } from '../services/roomService';

export function useRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeRoom(roomId, (data) => {
      setRoom(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [roomId]);

  return { room, loading };
}
