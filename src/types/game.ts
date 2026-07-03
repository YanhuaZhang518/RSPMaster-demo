export type Move = 'rock' | 'scissors' | 'paper' | null;

export type CardColor = 'white' | 'blue' | 'purple';

export type RoomStatus = 'waiting' | 'playing' | 'clash' | 'result' | 'finished';

export type ClashRoundWinner = 'player1' | 'player2' | 'draw';

export interface CardDef {
  id: string;
  name: string;
  color: CardColor;
  level: 1 | 2 | 3;
  description: string;
}

export interface HandCard {
  id: string;
  cardId: string;
}

export interface PlayerState {
  id: string;
  name: string;
  hp: number;
  handCards: HandCard[];
  selectedMove: Move;
  selectedCardId: string | null;
  locked: boolean;
  /** 碎卡当前轮次点击时间戳，null 表示本轮未点击 */
  clashTapAt: number | null;
}

export interface ClashMode {
  active: boolean;
  /** 当前轮次 0-5 */
  roundIndex: number;
  /** 当前 0.2 秒点击窗口结束时间 */
  roundEndsAt: number;
  player1RoundWins: number;
  player2RoundWins: number;
  roundResults: ClashRoundWinner[];
}

export interface RoundResult {
  round: number;
  player1Move: Move;
  player2Move: Move;
  player1CardId: string | null;
  player2CardId: string | null;
  player1CardName: string | null;
  player2CardName: string | null;
  clashTriggered: boolean;
  isClashRound: boolean;
  player1Damage: number;
  player2Damage: number;
  player1HpAfter: number;
  player2HpAfter: number;
  rpsWinner: 'player1' | 'player2' | 'draw' | null;
  details: string[];
  confuseEffect?: {
    forPlayer: 'player1' | 'player2';
    targetPlayer: 'player1' | 'player2';
    originalMove: Move;
    confusedMove: Move;
  };
  clashTapResult?: {
    player1Wins: number;
    player2Wins: number;
    roundResults: ClashRoundWinner[];
  };
}

export interface RoomState {
  status: RoomStatus;
  hostId: string;
  players: {
    player1: PlayerState | null;
    player2: PlayerState | null;
  };
  round: number;
  timerEndsAt: number;
  clashMode: ClashMode;
  lastResult: RoundResult | null;
  winner: 'player1' | 'player2' | null;
  createdAt: number;
}

export type PlayerSlot = 'player1' | 'player2';
