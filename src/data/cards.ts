import type { CardDef, HandCard } from '../types/game';

export const CARD_DEFS: Record<string, CardDef> = {
  white1: {
    id: 'white1',
    name: '重拳',
    color: 'white',
    level: 1,
    description: '如果本回合猜拳胜利，额外造成 1 点伤害。',
  },
  white2: {
    id: 'white2',
    name: '格挡',
    color: 'white',
    level: 2,
    description: '本回合受到的伤害 -1，最低为 0。',
  },
  white3: {
    id: 'white3',
    name: '反击',
    color: 'white',
    level: 3,
    description: '如果本回合猜拳失败，对方也受到 1 点伤害。',
  },
  blue1: {
    id: 'blue1',
    name: '封印',
    color: 'blue',
    level: 1,
    description: '使对方本回合卡牌失效。',
  },
  blue2: {
    id: 'blue2',
    name: '迷惑',
    color: 'blue',
    level: 2,
    description: '结算时随机修改对方本回合的猜拳选择（即使对方已锁定）。',
  },
  purple1: {
    id: 'purple1',
    name: '规则逆转',
    color: 'purple',
    level: 1,
    description: '本回合猜拳克制关系反转。',
  },
};

export const CARD_COLOR_LABEL: Record<string, string> = {
  white: '白',
  blue: '蓝',
  purple: '紫',
};

export function createInitialHand(): HandCard[] {
  const cardIds = ['white1', 'white2', 'white3', 'blue1', 'blue2', 'purple1'];
  return cardIds.map((cardId, i) => ({
    id: `hand-${cardId}-${i}`,
    cardId,
  }));
}

export function getCardDef(cardId: string): CardDef | undefined {
  return CARD_DEFS[cardId];
}

export function getCardDisplayName(cardId: string): string {
  const def = CARD_DEFS[cardId];
  if (!def) return cardId;
  const colorLabel = CARD_COLOR_LABEL[def.color];
  return `${colorLabel}${def.level}【${def.name}】`;
}

export const MOVE_EMOJI: Record<string, string> = {
  rock: '✊',
  scissors: '✌️',
  paper: '✋',
};

export const MOVE_LABEL: Record<string, string> = {
  rock: '石头',
  scissors: '剪刀',
  paper: '布',
};
