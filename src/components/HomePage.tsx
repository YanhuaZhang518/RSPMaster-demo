import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from './Layout';
import { createRoom } from '../services/roomService';
import {
  generateRoomId,
  getOrCreatePlayerId,
  getPlayerName,
  savePlayerName,
  saveRoomId,
} from '../utils/storage';

export function HomePage() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState(() => {
    const saved = getPlayerName();
    return saved === '玩家' ? '' : saved;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getName = () => {
    const name = playerName.trim() || '玩家';
    savePlayerName(name);
    return name;
  };

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const playerId = getOrCreatePlayerId();
      let roomId = generateRoomId();
      let attempts = 0;
      while (attempts < 5) {
        try {
          await createRoom(roomId, playerId, getName());
          break;
        } catch {
          roomId = generateRoomId();
          attempts++;
        }
      }
      if (attempts >= 5) throw new Error('创建房间失败，请重试');
      saveRoomId(roomId);
      navigate(`/room/${roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError('请输入房间号');
      return;
    }
    getOrCreatePlayerId();
    if (playerName.trim()) savePlayerName(playerName.trim());
    saveRoomId(code);
    navigate(`/room/${code}`);
  };

  return (
    <Layout title="石头剪刀布 · 卡牌对战">
      <div className="home-page">
        <p className="subtitle">1V1 快节奏联机对战 Demo</p>

        <div className="form-group">
          <label htmlFor="playerName">昵称</label>
          <input
            id="playerName"
            type="text"
            placeholder="输入昵称（可选）"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={12}
          />
        </div>

        <button className="btn btn-primary btn-large" onClick={handleCreate} disabled={loading}>
          {loading ? '创建中...' : '创建房间'}
        </button>

        <div className="divider">
          <span>或</span>
        </div>

        <div className="form-group">
          <label htmlFor="joinCode">房间号</label>
          <input
            id="joinCode"
            type="text"
            placeholder="输入 6 位房间号"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
        </div>

        <button className="btn btn-secondary btn-large" onClick={handleJoin}>
          加入房间
        </button>

        {error && <p className="error-msg">{error}</p>}

        <div className="rules-hint">
          <h3>玩法简介</h3>
          <ul>
            <li>每局 5 点生命，每回合 5 秒选择出拳 + 卡牌</li>
            <li>猜拳胜利造成 1 点伤害，卡牌可改变战局</li>
            <li>同色同等级卡牌触发「碎卡」极速猜拳</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
