import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from './Layout';
import { ResultModal } from './ResultModal';
import { useRoom } from '../hooks/useRoom';
import { formatCountdown, useCountdown } from '../hooks/useCountdown';
import {
  getCardDef,
  getCardDisplayName,
  MOVE_EMOJI,
  MOVE_LABEL,
} from '../data/cards';
import {
  getPlayerSlot,
  joinRoom,
  lockClashMove,
  lockSelection,
  nextRound,
  tryResolveClash,
  tryResolveRound,
  updateClashMove,
  updateSelection,
} from '../services/roomService';
import { getOrCreatePlayerId, getPlayerName } from '../utils/storage';
import type { Move, PlayerSlot } from '../types/game';

export function BattlePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room, loading } = useRoom(roomId);
  const [playerId] = useState(getOrCreatePlayerId);
  const [slot, setSlot] = useState<PlayerSlot | null>(null);
  const [selectedMove, setSelectedMove] = useState<Move>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [clashMove, setClashMove] = useState<Move>(null);

  const isPlaying = room?.status === 'playing';
  const isClash = room?.status === 'clash';
  const isResult = room?.status === 'result';
  const isHost = room?.hostId === playerId;

  const roundRemaining = useCountdown(room?.timerEndsAt ?? 0, !!isPlaying);
  const clashRemaining = useCountdown(room?.clashMode?.timerEndsAt ?? 0, !!isClash);

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

  // Host resolves rounds
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
      const p1 = room.players.player1;
      const p2 = room.players.player2;
      const bothLocked = p1?.clashLocked && p2?.clashLocked;
      const timerDone = room.clashMode.timerEndsAt > 0 && Date.now() >= room.clashMode.timerEndsAt;
      if (bothLocked || timerDone) {
        tryResolveClash(roomId, playerId);
      }
    }
  }, [room, roomId, isHost, playerId, roundRemaining, clashRemaining]);

  // Poll for host resolution when timer expires
  useEffect(() => {
    if (!roomId || !isHost || !room) return;
    if (room.status !== 'playing' && room.status !== 'clash') return;

    const interval = setInterval(() => {
      if (room.status === 'playing') {
        tryResolveRound(roomId, playerId);
      } else if (room.status === 'clash') {
        tryResolveClash(roomId, playerId);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [roomId, isHost, playerId, room?.status]);

  const me = slot ? room?.players[slot] : null;
  const opponent = slot === 'player1' ? room?.players.player2 : room?.players.player1;
  const isLocked = isPlaying ? me?.locked ?? false : me?.clashLocked ?? false;

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
    if (!roomId || !slot || isLocked) return;
    if (isPlaying) {
      await lockSelection(roomId, slot);
    }
  };

  const handleClashMove = async (move: Move) => {
    if (!roomId || !slot || isLocked || !isClash) return;
    setClashMove(move);
    await updateClashMove(roomId, slot, move);
  };

  const handleClashLock = async () => {
    if (!roomId || !slot || isLocked || !isClash) return;
    await lockClashMove(roomId, slot);
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

  return (
    <Layout>
      <div className="battle-page">
        {/* HP Bar */}
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

        {/* Timer */}
        {isPlaying && (
          <div className={`timer ${roundRemaining <= 2000 ? 'urgent' : ''}`}>
            ⏱ {formatCountdown(roundRemaining)}s
          </div>
        )}
        {isClash && (
          <div className="timer clash-timer urgent">
            ⚡ 极速猜拳 {formatCountdown(clashRemaining)}s
          </div>
        )}

        {/* Opponent status */}
        <div className="opponent-status">
          对方: {isPlaying ? (opponent?.locked ? '🔒 已锁定' : '⏳ 选择中...') : ''}
          {isClash ? (opponent?.clashLocked ? '🔒 已锁定' : '⏳ 选择中...') : ''}
        </div>

        {/* Clash mode */}
        {isClash && (
          <div className="clash-section">
            <p className="clash-hint">碎卡触发！仅可选择石头/剪刀/布</p>
            <div className="move-buttons">
              {(['rock', 'scissors', 'paper'] as const).map((move) => (
                <button
                  key={move}
                  className={`move-btn ${clashMove === move ? 'selected' : ''}`}
                  onClick={() => handleClashMove(move)}
                  disabled={isLocked}
                >
                  <span className="move-emoji">{MOVE_EMOJI[move]}</span>
                  <span>{MOVE_LABEL[move]}</span>
                </button>
              ))}
            </div>
            {!isLocked ? (
              <button
                className="btn btn-primary btn-large lock-btn"
                onClick={handleClashLock}
                disabled={!clashMove}
              >
                锁定选择
              </button>
            ) : (
              <div className="locked-badge">🔒 已锁定，等待对方...</div>
            )}
          </div>
        )}

        {/* Normal round */}
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
              <h3>手牌</h3>
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
