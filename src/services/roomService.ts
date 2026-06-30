import {
  ref,
  set,
  get,
  update,
  onValue,
  off,
  runTransaction,
} from 'firebase/database';
import { db } from '../firebase';
import { createInitialHand } from '../data/cards';
import type { Move, PlayerSlot, RoomState } from '../types/game';
import {
  CLASH_DURATION_MS,
  removeUsedCard,
  resolveClashRound,
  resolveNormalRound,
  ROUND_DURATION_MS,
} from '../utils/gameLogic';

function createEmptyPlayer(id: string, name: string) {
  return {
    id,
    name,
    hp: 5,
    handCards: createInitialHand(),
    selectedMove: null as Move,
    selectedCardId: null as string | null,
    locked: false,
    clashMove: null as Move,
    clashLocked: false,
  };
}

function roomRef(roomId: string) {
  return ref(db, `rooms/${roomId}`);
}

export async function createRoom(roomId: string, hostId: string, hostName: string) {
  const existing = await get(roomRef(roomId));
  if (existing.exists()) {
    throw new Error('房间号已存在，请重试');
  }

  const room: RoomState = {
    status: 'waiting',
    hostId,
    players: {
      player1: createEmptyPlayer(hostId, hostName),
      player2: null,
    },
    round: 1,
    timerEndsAt: 0,
    clashMode: { active: false, timerEndsAt: 0 },
    lastResult: null,
    winner: null,
    createdAt: Date.now(),
  };

  await set(roomRef(roomId), room);
}

export async function joinRoom(
  roomId: string,
  playerId: string,
  playerName: string,
): Promise<{ slot: PlayerSlot; full: boolean }> {
  const snapshot = await get(roomRef(roomId));
  if (!snapshot.exists()) {
    throw new Error('房间不存在');
  }

  const room = snapshot.val() as RoomState;
  const p1 = room.players.player1;
  const p2 = room.players.player2;

  if (p1?.id === playerId) return { slot: 'player1', full: false };
  if (p2?.id === playerId) return { slot: 'player2', full: false };

  if (p1 && p2) {
    return { slot: 'player2', full: true };
  }

  if (!p2) {
    await update(roomRef(roomId), {
      'players/player2': createEmptyPlayer(playerId, playerName),
    });
    return { slot: 'player2', full: false };
  }

  return { slot: 'player2', full: true };
}

export function subscribeRoom(
  roomId: string,
  callback: (room: RoomState | null) => void,
) {
  const r = roomRef(roomId);
  onValue(r, (snap) => {
    callback(snap.exists() ? (snap.val() as RoomState) : null);
  });
  return () => off(r);
}

export async function startGame(roomId: string, hostId: string) {
  const snapshot = await get(roomRef(roomId));
  if (!snapshot.exists()) return;
  const room = snapshot.val() as RoomState;
  if (room.hostId !== hostId) return;
  if (!room.players.player1 || !room.players.player2) return;

  const timerEndsAt = Date.now() + ROUND_DURATION_MS;
  await update(roomRef(roomId), {
    status: 'playing',
    round: 1,
    timerEndsAt,
    lastResult: null,
    winner: null,
    'players/player1/selectedMove': null,
    'players/player1/selectedCardId': null,
    'players/player1/locked': false,
    'players/player1/clashMove': null,
    'players/player1/clashLocked': false,
    'players/player2/selectedMove': null,
    'players/player2/selectedCardId': null,
    'players/player2/locked': false,
    'players/player2/clashMove': null,
    'players/player2/clashLocked': false,
    'clashMode/active': false,
    'clashMode/timerEndsAt': 0,
  });
}

export async function updateSelection(
  roomId: string,
  slot: PlayerSlot,
  move: Move,
  cardId: string | null,
) {
  await update(roomRef(roomId), {
    [`players/${slot}/selectedMove`]: move,
    [`players/${slot}/selectedCardId`]: cardId,
  });
}

export async function lockSelection(roomId: string, slot: PlayerSlot) {
  await update(roomRef(roomId), {
    [`players/${slot}/locked`]: true,
  });
}

export async function updateClashMove(roomId: string, slot: PlayerSlot, move: Move) {
  await update(roomRef(roomId), {
    [`players/${slot}/clashMove`]: move,
  });
}

export async function lockClashMove(roomId: string, slot: PlayerSlot) {
  await update(roomRef(roomId), {
    [`players/${slot}/clashLocked`]: true,
  });
}

export async function tryResolveRound(roomId: string, hostId: string) {
  const snapshot = await get(roomRef(roomId));
  if (!snapshot.exists()) return;
  const room = snapshot.val() as RoomState;
  if (room.hostId !== hostId) return;
  if (room.status !== 'playing') return;

  const p1 = room.players.player1;
  const p2 = room.players.player2;
  if (!p1 || !p2) return;

  const now = Date.now();
  const bothLocked = p1.locked && p2.locked;
  const timerExpired = room.timerEndsAt > 0 && now >= room.timerEndsAt;
  if (!bothLocked && !timerExpired) return;

  const { result, triggerClash } = resolveNormalRound(p1, p2, room.round);

  if (triggerClash) {
    const clashTimerEndsAt = Date.now() + CLASH_DURATION_MS;
    await update(roomRef(roomId), {
      status: 'clash',
      lastResult: result,
      'clashMode/active': true,
      'clashMode/timerEndsAt': clashTimerEndsAt,
      'players/player1/clashMove': null,
      'players/player1/clashLocked': false,
      'players/player2/clashMove': null,
      'players/player2/clashLocked': false,
    });
    return;
  }

  const p1Hand = removeUsedCard(p1.handCards, p1.selectedCardId);
  const p2Hand = removeUsedCard(p2.handCards, p2.selectedCardId);

  let winner: RoomState['winner'] = null;
  if (result.player1HpAfter <= 0 && result.player2HpAfter <= 0) winner = null;
  else if (result.player1HpAfter <= 0) winner = 'player2';
  else if (result.player2HpAfter <= 0) winner = 'player1';

  await update(roomRef(roomId), {
    status: winner ? 'finished' : 'result',
    lastResult: result,
    winner,
    'players/player1/hp': result.player1HpAfter,
    'players/player2/hp': result.player2HpAfter,
    'players/player1/handCards': p1Hand,
    'players/player2/handCards': p2Hand,
  });
}

export async function tryResolveClash(roomId: string, hostId: string) {
  const snapshot = await get(roomRef(roomId));
  if (!snapshot.exists()) return;
  const room = snapshot.val() as RoomState;
  if (room.hostId !== hostId) return;
  if (room.status !== 'clash') return;

  const p1 = room.players.player1;
  const p2 = room.players.player2;
  if (!p1 || !p2) return;

  const now = Date.now();
  const bothLocked = p1.clashLocked && p2.clashLocked;
  const timerExpired = room.clashMode.timerEndsAt > 0 && now >= room.clashMode.timerEndsAt;
  if (!bothLocked && !timerExpired) return;

  const clashResult = resolveClashRound(p1, p2, room.round);

  const p1Hand = removeUsedCard(p1.handCards, p1.selectedCardId);
  const p2Hand = removeUsedCard(p2.handCards, p2.selectedCardId);

  let winner: RoomState['winner'] = null;
  if (clashResult.player1HpAfter <= 0 && clashResult.player2HpAfter <= 0) winner = null;
  else if (clashResult.player1HpAfter <= 0) winner = 'player2';
  else if (clashResult.player2HpAfter <= 0) winner = 'player1';

  await update(roomRef(roomId), {
    status: winner ? 'finished' : 'result',
    lastResult: clashResult,
    winner,
    'players/player1/hp': clashResult.player1HpAfter,
    'players/player2/hp': clashResult.player2HpAfter,
    'players/player1/handCards': p1Hand,
    'players/player2/handCards': p2Hand,
    'clashMode/active': false,
    'clashMode/timerEndsAt': 0,
  });
}

export async function nextRound(roomId: string) {
  const newTimerEndsAt = Date.now() + ROUND_DURATION_MS;
  await runTransaction(roomRef(roomId), (room: RoomState | null) => {
    if (!room || room.status !== 'result') return;
    const p1 = room.players.player1;
    const p2 = room.players.player2;
    if (!p1 || !p2) return;
    return {
      ...room,
      status: 'playing' as const,
      round: room.round + 1,
      timerEndsAt: newTimerEndsAt,
      lastResult: null,
      players: {
        player1: { ...p1, selectedMove: null, selectedCardId: null, locked: false, clashMove: null, clashLocked: false },
        player2: { ...p2, selectedMove: null, selectedCardId: null, locked: false, clashMove: null, clashLocked: false },
      },
    };
  });
}

export async function restartGame(roomId: string) {
  const newTimerEndsAt = Date.now() + ROUND_DURATION_MS;
  await runTransaction(roomRef(roomId), (room: RoomState | null) => {
    if (!room || room.status !== 'finished') return;
    const p1 = room.players.player1;
    const p2 = room.players.player2;
    if (!p1 || !p2) return;
    return {
      ...room,
      status: 'playing' as const,
      round: 1,
      timerEndsAt: newTimerEndsAt,
      lastResult: null,
      winner: null,
      players: {
        player1: createEmptyPlayer(p1.id, p1.name),
        player2: createEmptyPlayer(p2.id, p2.name),
      },
      clashMode: { active: false, timerEndsAt: 0 },
    };
  });
}

export async function leaveRoom(roomId: string, playerId: string) {
  await runTransaction(roomRef(roomId), (room: RoomState | null) => {
    if (!room) return room;
    if (room.players.player1?.id === playerId) {
      room.players.player1 = null;
    }
    if (room.players.player2?.id === playerId) {
      room.players.player2 = null;
    }
    if (!room.players.player1 && !room.players.player2) {
      return null;
    }
    return room;
  });
}

export function getPlayerSlot(room: RoomState, playerId: string): PlayerSlot | null {
  if (room.players.player1?.id === playerId) return 'player1';
  if (room.players.player2?.id === playerId) return 'player2';
  return null;
}
