import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from './Layout';
import { useRoom } from '../hooks/useRoom';
import {
  getPlayerSlot,
  joinRoom,
  startGame,
} from '../services/roomService';
import {
  getOrCreatePlayerId,
  getPlayerName,
  saveRoomId,
} from '../utils/storage';
import type { PlayerSlot } from '../types/game';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room, loading } = useRoom(roomId);
  const [playerId] = useState(getOrCreatePlayerId);
  const [slot, setSlot] = useState<PlayerSlot | null>(null);
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    saveRoomId(roomId);

    let cancelled = false;
    (async () => {
      try {
        const result = await joinRoom(roomId, playerId, getPlayerName());
        if (cancelled) return;
        if (result.full) {
          setJoinError('房间已满');
          setSlot(null);
        } else {
          setSlot(result.slot);
          setJoinError('');
        }
      } catch (e) {
        if (!cancelled) {
          setJoinError(e instanceof Error ? e.message : '加入失败');
        }
      } finally {
        if (!cancelled) setJoining(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomId, playerId]);

  useEffect(() => {
    if (!room || !playerId) return;
    const s = getPlayerSlot(room, playerId);
    if (s) setSlot(s);

    if (room.status === 'playing' || room.status === 'clash' || room.status === 'result') {
      navigate(`/room/${roomId}/battle`, { replace: true });
    }
    if (room.status === 'finished') {
      navigate(`/room/${roomId}/end`, { replace: true });
    }
  }, [room, playerId, roomId, navigate]);

  const isHost = room?.hostId === playerId;
  const shareUrl = `${window.location.origin}/room/${roomId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStart = async () => {
    if (!roomId || !isHost) return;
    await startGame(roomId, playerId);
  };

  if (loading || joining) {
    return (
      <Layout>
        <p className="loading-text">加载中...</p>
      </Layout>
    );
  }

  if (!room) {
    return (
      <Layout title="房间不存在">
        <p className="error-msg">房间 {roomId} 不存在或已关闭</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          返回首页
        </button>
      </Layout>
    );
  }

  if (joinError === '房间已满' && !slot) {
    return (
      <Layout title="房间已满">
        <p className="error-msg">该房间已有 2 名玩家，无法加入。</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          返回首页
        </button>
      </Layout>
    );
  }

  const p1 = room.players.player1;
  const p2 = room.players.player2;

  return (
    <Layout title="等待房间">
      <div className="room-page">
        <div className="room-code-box">
          <span className="label">房间号</span>
          <span className="room-code">{roomId}</span>
        </div>

        <div className="share-box">
          <p className="share-label">分享链接给朋友</p>
          <div className="share-row">
            <input className="share-input" readOnly value={shareUrl} />
            <button className="btn btn-small" onClick={copyLink}>
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </div>

        <div className="player-list">
          <div className={`player-row ${p1 ? 'joined' : 'empty'}`}>
            <span className="player-label">玩家 1 {isHost && slot === 'player1' ? '（你·房主）' : ''}</span>
            <span className="player-status">{p1 ? `✅ ${p1.name}` : '⏳ 等待加入'}</span>
          </div>
          <div className={`player-row ${p2 ? 'joined' : 'empty'}`}>
            <span className="player-label">玩家 2 {!isHost && slot === 'player2' ? '（你）' : ''}</span>
            <span className="player-status">{p2 ? `✅ ${p2.name}` : '⏳ 等待加入'}</span>
          </div>
        </div>

        {isHost && p1 && p2 && (
          <button className="btn btn-primary btn-large" onClick={handleStart}>
            开始游戏
          </button>
        )}

        {!isHost && p1 && p2 && (
          <p className="hint-text">等待房主开始游戏...</p>
        )}

        {isHost && (!p1 || !p2) && (
          <p className="hint-text">等待另一位玩家加入...</p>
        )}

        {joinError && joinError !== '房间已满' && (
          <p className="error-msg">{joinError}</p>
        )}
      </div>
    </Layout>
  );
}
