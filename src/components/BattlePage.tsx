import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from './Layout';
import { ResultModal } from './ResultModal';
import { useRoom } from '../hooks/useRoom';
import { formatCountdown, useCountdown } from '../hooks/useCountdown';
import { CLASH_ROUNDS } from '../utils/gameLogic';
import {
  getCardDef,
  getCardDisplayName,
  MOVE_EMOJI,
  MOVE_LABEL,
} from '../data/cards';
import {
  getPlayerSlot,
  joinRoom,
  lockSelection,
  nextRound,
  registerClashTap,
  tryAdvanceClash,
  tryResolveRound,
  updateSelection,
} from '../services/roomService';
import { getOrCreatePlayerId, getPlayerName } from '../utils/storage';
import type { Move, PlayerSlot } from '../types/game';

function formatMsCountdown(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

export function BattlePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room, loading } = useRoom(roomId);
  const [playerId] = useState(getOrCreatePlayerId);
  const [slot, setSlot] = useState<PlayerSlot | null>(null);
  const [selectedMove, setSelectedMove] = useState<Move>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const isPlaying = room?.status === 'playing';
  const isClash = room?.status === 'clash';
  const isResult = room?.status === 'result';
  const isHost = room?.hostId === playerId;

  const roundRemaining = useCountdown(room?.timerEndsAt ?? 0, !!isPlaying);
  const clashRoundRemaining = useCountdown(room?.clashMode?.roundEndsAt ?? 0, !!isClash);

  useEffect(() => {
    if (!roomId) return;
    joinRoom(roomId, playerId, getPlayerName()).then((r) => {
      if (!r.full) setSlot(r.slot);
    });
  }, [roomId, playerId]);

  useEffect(() => {
    if (!room) return;
    const s = getPlayerSlot(room, playerId);
    if (s) setSlot(s);

    if (room.status === 'waiting') {
      navigate(`/room/${roomId}`, { replace: true });
    }
    if (room.status === 'finished') {
      navigate(`/room/${roomId}/end`, { replace: true });
    }
  }, [room, playerId, roomId, navigate]);

  useEffect(() => {
    if (!roomId || !isHost || !room) return;
    if (room.status === 'playing') {
      const p1 = room.players.player1;
      const p2 = room.players.player2;
      const bothLocked = p1?.locked && p2?.locked;
      const timerDone = room.timerEndsAt > 0 && Date.now() >= room.timerEndsAt;
      if (bothLocked || timerDone) {
        tryResolveRound(roomId, playerId);
      }
    }
    if (room.status === 'clash') {
      const timerDone = room.clashMode.roundEndsAt > 0 && Date.now() >= room.clashMode.roundEndsAt;
      if (timerDone) {
        tryAdvanceClash(roomId, playerId);
      }
    }
  }, [room, roomId, isHost, playerId, roundRemaining, clashRoundRemaining]);

  useEffect(() => {
    if (!roomId || !isHost || !room) return;
    if (room.status !== 'playing' && room.status !== 'clash') return;

    const interval = setInterval(() => {
      if (room.status === 'playing') {
        tryResolveRound(roomId, playerId);
      } else if (room.status === 'clash') {
        tryAdvanceClash(roomId, playerId);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [roomId, isHost, playerId, room?.status]);

  const me = slot ? room?.players[slot] : null;
  const opponent = slot === 'player1' ? room?.players.player2 : room?.players.player1;
  const isLocked = me?.locked ?? false;
  const hasTappedThisClashRound = me?.clashTapAt != null;

  const handleSelectMove = async (move: Move) => {
    if (!roomId || !slot || isLocked || !isPlaying) return;
    setSelectedMove(move);
    await updateSelection(roomId, slot, move, selectedCardId);
  };

  const handleSelectCard = async (cardId: string) => {
    if (!roomId || !slot || isLocked || !isPlaying) return;
    const newCardId = selectedCardId === cardId ? null : cardId;
    setSelectedCardId(newCardId);
    await updateSelection(roomId, slot, selectedMove, newCardId);
  };

  const handleLock = async () => {
    if (!roomId || !slot || isLocked || !isPlaying) return;
    await lockSelection(roomId, slot);
  };

  const handleClashTap = async () => {
    if (!roomId || !slot || !isClash || hasTappedThisClashRound) return;
    await registerClashTap(roomId, slot);
  };

  const handleNextRound = useCallback(async () => {
    if (!roomId) return;
    await nextRound(roomId);
  }, [roomId]);

  if (loading || !room || !slot || !me) {
    return (
      <Layout>
        <p className="loading-text">加载对战...</p>
      </Layout>
    );
  }

  const p1 = room.players.player1!;
  const p2 = room.players.player2!;
  const clashRound = room.clashMode.roundIndex + 1;
  const myClashWins = slot === 'player1'
    ? room.clashMode.player1RoundWins
    : room.clashMode.player2RoundWins;
  const oppClashWins = slot === 'player1'
    ? room.clashMode.player2RoundWins
    : room.clashMode.player1RoundWins;

  return (
    <Layout>
      <div className="battle-page">
        <div className="hp-bar">
          <div className="hp-side">
            <span className="hp-name">{p1.name}{slot === 'player1' ? ' (你)' : ''}</span>
            <div className="hp-hearts">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < p1.hp ? 'heart full' : 'heart empty'}>❤️</span>
              ))}
            </div>
          </div>
          <div className="round-badge">R{room.round}</div>
          <div className="hp-side">
            <span className="hp-name">{p2.name}{slot === 'player2' ? ' (你)' : ''}</span>
            <div className="hp-hearts">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < p2.hp ? 'heart full' : 'heart empty'}>❤️</span>
              ))}
            </div>
          </div>
        </div>

        {isPlaying && (
          <div className={`timer ${roundRemaining <= 2000 ? 'urgent' : ''}`}>
            ⏱ {formatCountdown(roundRemaining)}s
          </div>
        )}

        {isClash && (
          <div className="timer clash-timer urgent">
            ⚡ 碎卡连点 第 {clashRound}/{CLASH_ROUNDS} 轮 · {formatMsCountdown(clashRoundRemaining)}s
          </div>
        )}

        <div className="opponent-status">
          {isPlaying && `对方: ${opponent?.locked ? '🔒 已锁定' : '⏳ 选择中...'}`}
          {isClash && `比分 你 ${myClashWins} : ${oppClashWins} 对方 · ${opponent?.clashTapAt ? '对方已点击' : '等待对方点击'}`}
        </div>

        {isClash && (
          <div className="clash-section">
            <p className="clash-hint">每轮 0.2 秒点击窗口，共 6 轮，赢的次数多者获胜</p>
            <div className="clash-score">
              <span>你: {myClashWins}</span>
              <span>VS</span>
              <span>对方: {oppClashWins}</span>
            </div>
            <button
              className={`clash-tap-btn ${hasTappedThisClashRound ? 'tapped' : ''}`}
              onClick={handleClashTap}
              disabled={hasTappedThisClashRound || clashRoundRemaining <= 0}
            >
              {hasTappedThisClashRound ? '✓ 已点击' : '点击!'}
            </button>
          </div>
        )}

        {isPlaying && (
          <>
            <div className="move-buttons">
              {(['rock', 'scissors', 'paper'] as const).map((move) => (
                <button
                  key={move}
                  className={`move-btn ${selectedMove === move ? 'selected' : ''}`}
                  onClick={() => handleSelectMove(move)}
                  disabled={isLocked}
                >
                  <span className="move-emoji">{MOVE_EMOJI[move]}</span>
                  <span>{MOVE_LABEL[move]}</span>
                </button>
              ))}
            </div>

            <div className="cards-section">
              <h3>手牌 <span className="optional-label">（可选，不必每回合出牌）</span></h3>
              <div className="card-grid">
                {me.handCards.map((handCard) => {
                  const def = getCardDef(handCard.cardId);
                  if (!def) return null;
                  const isSelected = selectedCardId === handCard.cardId;
                  return (
                    <button
                      key={handCard.id}
                      className={`card-btn color-${def.color} ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectCard(handCard.cardId)}
                      disabled={isLocked}
                    >
                      <span className="card-name">{getCardDisplayName(handCard.cardId)}</span>
                      <span className="card-desc">{def.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!isLocked ? (
              <button
                className="btn btn-primary btn-large lock-btn"
                onClick={handleLock}
              >
                锁定选择
              </button>
            ) : (
              <div className="locked-badge">🔒 已锁定，等待对方...</div>
            )}
            <p className="hint-text">超时未出拳将直接扣 1 点生命</p>
          </>
        )}

        {isResult && room.lastResult && (
          <ResultModal
            result={room.lastResult}
            mySlot={slot}
            onNext={handleNextRound}
          />
        )}
      </div>
    </Layout>
  );
}
