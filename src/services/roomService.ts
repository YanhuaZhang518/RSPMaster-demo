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
import type { ClashRoundWinner, Move, PlayerSlot, RoomState } from '../types/game';
import {
  CLASH_ROUND_MS,
  CLASH_ROUNDS,
  removeUsedCard,
  resolveClashRound,
  resolveClashRoundWinner,
  resolveNormalRound,
  ROUND_DURATION_MS,
} from '../utils/gameLogic';

function createEmptyClashMode(): RoomState['clashMode'] {
  return {
    active: false,
    roundIndex: 0,
    roundEndsAt: 0,
    player1RoundWins: 0,
    player2RoundWins: 0,
    roundResults: [],
  };
}

function createEmptyPlayer(id: string, name: string) {
  return {
    id,
    name,
    hp: 5,
    handCards: createInitialHand(),
    selectedMove: null as Move,
    selectedCardId: null as string | null,
    locked: false,
    clashTapAt: null as number | null,
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
    clashMode: createEmptyClashMode(),
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

function resetPlayerRoundState() {
  return {
    selectedMove: null,
    selectedCardId: null,
    locked: false,
    clashTapAt: null,
  };
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
    'players/player1/clashTapAt': null,
    'players/player2/selectedMove': null,
    'players/player2/selectedCardId': null,
    'players/player2/locked': false,
    'players/player2/clashTapAt': null,
    clashMode: createEmptyClashMode(),
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

export async function registerClashTap(roomId: string, slot: PlayerSlot) {
  const snapshot = await get(roomRef(roomId));
  if (!snapshot.exists()) return;
  const room = snapshot.val() as RoomState;
  if (room.status !== 'clash' || !room.clashMode.active) return;

  const now = Date.now();
  if (now > room.clashMode.roundEndsAt) return;

  const player = room.players[slot];
  if (!player || player.clashTapAt !== null) return;

  await update(roomRef(roomId), {
    [`players/${slot}/clashTapAt`]: now,
  });
}

export async function tryAdvanceClash(roomId: string) {
  await runTransaction(roomRef(roomId), (room: RoomState | null) => {
    if (!room || room.status !== 'clash' || !room.clashMode.active) return;

    const p1 = room.players.player1;
    const p2 = room.players.player2;
    if (!p1 || !p2) return;

    const now = Date.now();
    if (now < room.clashMode.roundEndsAt) return;

    const roundWinner = resolveClashRoundWinner(p1.clashTapAt, p2.clashTapAt);
    const roundResults: ClashRoundWinner[] = [...room.clashMode.roundResults, roundWinner];
    const player1RoundWins = room.clashMode.player1RoundWins + (roundWinner === 'player1' ? 1 : 0);
    const player2RoundWins = room.clashMode.player2RoundWins + (roundWinner === 'player2' ? 1 : 0);
    const nextRoundIndex = room.clashMode.roundIndex + 1;

    if (nextRoundIndex >= CLASH_ROUNDS) {
      const clashResult = resolveClashRound(
        p1,
        p2,
        room.round,
        player1RoundWins,
        player2RoundWins,
        roundResults,
      );
      const p1Hand = removeUsedCard(p1.handCards, p1.selectedCardId);
      const p2Hand = removeUsedCard(p2.handCards, p2.selectedCardId);

      let winner: RoomState['winner'] = null;
      if (clashResult.player1HpAfter <= 0 && clashResult.player2HpAfter <= 0) winner = null;
      else if (clashResult.player1HpAfter <= 0) winner = 'player2';
      else if (clashResult.player2HpAfter <= 0) winner = 'player1';

      return {
        ...room,
        status: winner ? ('finished' as const) : ('result' as const),
        lastResult: clashResult,
        winner,
        clashMode: createEmptyClashMode(),
        players: {
          player1: { ...p1, hp: clashResult.player1HpAfter, handCards: p1Hand, clashTapAt: null },
          player2: { ...p2, hp: clashResult.player2HpAfter, handCards: p2Hand, clashTapAt: null },
        },
      };
    }

    return {
      ...room,
      clashMode: {
        active: true,
        roundIndex: nextRoundIndex,
        roundEndsAt: now + CLASH_ROUND_MS,
        player1RoundWins,
        player2RoundWins,
        roundResults,
      },
      players: {
        player1: { ...p1, clashTapAt: null },
        player2: { ...p2, clashTapAt: null },
      },
    };
  });
}

export async function tryResolveRound(roomId: string) {
  await runTransaction(roomRef(roomId), (room: RoomState | null) => {
    if (!room || room.status !== 'playing') return;

    const p1 = room.players.player1;
    const p2 = room.players.player2;
    if (!p1 || !p2) return;

    const now = Date.now();
    const bothLocked = p1.locked && p2.locked;
    const timerExpired = room.timerEndsAt > 0 && now >= room.timerEndsAt;
    if (!bothLocked && !timerExpired) return;

    const { result, triggerClash } = resolveNormalRound(p1, p2, room.round, timerExpired);

    if (triggerClash) {
      const roundEndsAt = Date.now() + CLASH_ROUND_MS;
      return {
        ...room,
        status: 'clash' as const,
        lastResult: result,
        clashMode: {
          active: true,
          roundIndex: 0,
          roundEndsAt,
          player1RoundWins: 0,
          player2RoundWins: 0,
          roundResults: [],
        },
        players: {
          player1: { ...p1, clashTapAt: null },
          player2: { ...p2, clashTapAt: null },
        },
      };
    }

    const p1Hand = removeUsedCard(p1.handCards, p1.selectedCardId);
    const p2Hand = removeUsedCard(p2.handCards, p2.selectedCardId);

    let winner: RoomState['winner'] = null;
    if (result.player1HpAfter <= 0 && result.player2HpAfter <= 0) winner = null;
    else if (result.player1HpAfter <= 0) winner = 'player2';
    else if (result.player2HpAfter <= 0) winner = 'player1';

    return {
      ...room,
      status: winner ? ('finished' as const) : ('result' as const),
      lastResult: result,
      winner,
      players: {
        player1: { ...p1, hp: result.player1HpAfter, handCards: p1Hand },
        player2: { ...p2, hp: result.player2HpAfter, handCards: p2Hand },
      },
    };
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
        player1: { ...p1, ...resetPlayerRoundState() },
        player2: { ...p2, ...resetPlayerRoundState() },
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
      clashMode: createEmptyClashMode(),
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
