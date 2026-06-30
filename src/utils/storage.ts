const PLAYER_ID_KEY = 'rsc_player_id';
const ROOM_ID_KEY = 'rsc_room_id';
const PLAYER_NAME_KEY = 'rsc_player_name';

export function getOrCreatePlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function saveRoomId(roomId: string): void {
  localStorage.setItem(ROOM_ID_KEY, roomId);
}

export function getSavedRoomId(): string | null {
  return localStorage.getItem(ROOM_ID_KEY);
}

export function clearSavedRoomId(): void {
  localStorage.removeItem(ROOM_ID_KEY);
}

export function savePlayerName(name: string): void {
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

export function getPlayerName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) || '玩家';
}

export function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
