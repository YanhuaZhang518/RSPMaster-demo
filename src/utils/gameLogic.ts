import { getCardDef } from '../data/cards';
import type { Move, PlayerState, RoundResult } from '../types/game';

const NORMAL_WINS: Record<NonNullable<Move>, NonNullable<Move>> = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
};

const REVERSED_WINS: Record<NonNullable<Move>, NonNullable<Move>> = {
  rock: 'paper',
  scissors: 'rock',
  paper: 'scissors',
};

export function getRpsWinner(
  p1Move: Move,
  p2Move: Move,
  reversed: boolean,
): 'player1' | 'player2' | 'draw' | null {
  if (!p1Move || !p2Move) {
    if (!p1Move && !p2Move) return 'draw';
    if (p1Move && !p2Move) return 'player1';
    if (!p1Move && p2Move) return 'player2';
  }
  if (p1Move === p2Move) return 'draw';

  const wins = reversed ? REVERSED_WINS : NORMAL_WINS;
  if (wins[p1Move!] === p2Move) return 'player1';
  return 'player2';
}

export function isClash(cardId1: string | null, cardId2: string | null): boolean {
  if (!cardId1 || !cardId2) return false;
  const c1 = getCardDef(cardId1);
  const c2 = getCardDef(cardId2);
  if (!c1 || !c2) return false;
  return c1.color === c2.color && c1.level === c2.level;
}

interface ActiveCards {
  p1CardId: string | null;
  p2CardId: string | null;
  p1Sealed: boolean;
  p2Sealed: boolean;
  reversed: boolean;
  p1Scout: boolean;
  p2Scout: boolean;
}

function resolveActiveCards(
  p1CardId: string | null,
  p2CardId: string | null,
): ActiveCards {
  const p1Sealed = p2CardId === 'blue1';
  const p2Sealed = p1CardId === 'blue1';

  return {
    p1CardId: p1Sealed ? null : p1CardId,
    p2CardId: p2Sealed ? null : p2CardId,
    p1Sealed,
    p2Sealed,
    reversed:
      (!p1Sealed && p1CardId === 'purple1') || (!p2Sealed && p2CardId === 'purple1'),
    p1Scout: !p1Sealed && p1CardId === 'blue2',
    p2Scout: !p2Sealed && p2CardId === 'blue2',
  };
}

export function resolveNormalRound(
  p1: PlayerState,
  p2: PlayerState,
  round: number,
): { result: RoundResult; triggerClash: boolean } {
  const p1CardId = p1.selectedCardId;
  const p2CardId = p2.selectedCardId;
  const clashTriggered = isClash(p1CardId, p2CardId);

  if (clashTriggered) {
    return {
      triggerClash: true,
      result: {
        round,
        player1Move: p1.selectedMove,
        player2Move: p2.selectedMove,
        player1CardId: p1CardId,
        player2CardId: p2CardId,
        player1CardName: p1CardId ? getCardDef(p1CardId)?.name ?? null : null,
        player2CardName: p2CardId ? getCardDef(p2CardId)?.name ?? null : null,
        clashTriggered: true,
        isClashRound: false,
        player1Damage: 0,
        player2Damage: 0,
        player1HpAfter: p1.hp,
        player2HpAfter: p2.hp,
        rpsWinner: null,
        details: ['双方使用同色同等级卡牌，触发碎卡！进入极速猜拳模式。'],
      },
    };
  }

  const active = resolveActiveCards(p1CardId, p2CardId);
  const details: string[] = [];

  if (active.p1Sealed && p2CardId) details.push('玩家1使用【封印】，玩家2卡牌失效。');
  if (active.p2Sealed && p1CardId) details.push('玩家2使用【封印】，玩家1卡牌失效。');
  if (active.reversed) details.push('【规则逆转】生效，克制关系反转。');

  const rpsWinner = getRpsWinner(p1.selectedMove, p2.selectedMove, active.reversed);

  let p1Damage = 0;
  let p2Damage = 0;

  if (rpsWinner === 'player1') {
    p2Damage = 1;
    details.push('玩家1猜拳胜利，造成 1 点伤害。');
    if (active.p1CardId === 'white1') {
      p2Damage += 1;
      details.push('【重拳】生效，额外 1 点伤害。');
    }
    if (active.p2CardId === 'white3') {
      p1Damage += 1;
      details.push('【反击】生效，玩家2虽败但反击 1 点伤害。');
    }
  } else if (rpsWinner === 'player2') {
    p1Damage = 1;
    details.push('玩家2猜拳胜利，造成 1 点伤害。');
    if (active.p2CardId === 'white1') {
      p1Damage += 1;
      details.push('【重拳】生效，额外 1 点伤害。');
    }
    if (active.p1CardId === 'white3') {
      p2Damage += 1;
      details.push('【反击】生效，玩家1虽败但反击 1 点伤害。');
    }
  } else {
    details.push('猜拳平局，无基础伤害。');
  }

  if (active.p1CardId === 'white2' && p1Damage > 0) {
    const reduced = Math.min(p1Damage, 1);
    p1Damage -= reduced;
    details.push('【格挡】生效，玩家1受到的伤害 -1。');
  }
  if (active.p2CardId === 'white2' && p2Damage > 0) {
    const reduced = Math.min(p2Damage, 1);
    p2Damage -= reduced;
    details.push('【格挡】生效，玩家2受到的伤害 -1。');
  }

  const p1HpAfter = Math.max(0, p1.hp - p1Damage);
  const p2HpAfter = Math.max(0, p2.hp - p2Damage);

  const result: RoundResult = {
    round,
    player1Move: p1.selectedMove,
    player2Move: p2.selectedMove,
    player1CardId: p1CardId,
    player2CardId: p2CardId,
    player1CardName: p1CardId ? getCardDef(p1CardId)?.name ?? null : null,
    player2CardName: p2CardId ? getCardDef(p2CardId)?.name ?? null : null,
    clashTriggered: false,
    isClashRound: false,
    player1Damage: p1Damage,
    player2Damage: p2Damage,
    player1HpAfter: p1HpAfter,
    player2HpAfter: p2HpAfter,
    rpsWinner,
    details,
  };

  if (active.p1Scout && p2.selectedMove) {
    result.scoutReveal = { forPlayer: 'player1', opponentMove: p2.selectedMove };
  } else if (active.p2Scout && p1.selectedMove) {
    result.scoutReveal = { forPlayer: 'player2', opponentMove: p1.selectedMove };
  }

  return { result, triggerClash: false };
}

export function resolveClashRound(
  p1: PlayerState,
  p2: PlayerState,
  round: number,
): RoundResult {
  const rpsWinner = getRpsWinner(p1.clashMove, p2.clashMove, false);
  const details: string[] = ['极速猜拳结算'];

  let p1Damage = 0;
  let p2Damage = 0;

  if (rpsWinner === 'player1') {
    p2Damage = 1;
    details.push('玩家1极速猜拳胜利，造成 1 点伤害。');
  } else if (rpsWinner === 'player2') {
    p1Damage = 1;
    details.push('玩家2极速猜拳胜利，造成 1 点伤害。');
  } else {
    details.push('极速猜拳平局，无伤害。');
  }

  const p1HpAfter = Math.max(0, p1.hp - p1Damage);
  const p2HpAfter = Math.max(0, p2.hp - p2Damage);

  return {
    round,
    player1Move: p1.clashMove,
    player2Move: p2.clashMove,
    player1CardId: null,
    player2CardId: null,
    player1CardName: null,
    player2CardName: null,
    clashTriggered: false,
    isClashRound: true,
    player1Damage: p1Damage,
    player2Damage: p2Damage,
    player1HpAfter: p1HpAfter,
    player2HpAfter: p2HpAfter,
    rpsWinner,
    details,
  };
}

export function removeUsedCard(handCards: PlayerState['handCards'], cardId: string | null) {
  if (!cardId) return handCards;
  const idx = handCards.findIndex((c) => c.cardId === cardId);
  if (idx === -1) return handCards;
  return handCards.filter((_, i) => i !== idx);
}

export const ROUND_DURATION_MS = 5000;
export const CLASH_DURATION_MS = 1500;
