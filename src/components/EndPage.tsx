import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from './Layout';
import { useRoom } from '../hooks/useRoom';
import { getPlayerSlot, restartGame } from '../services/roomService';
import { getOrCreatePlayerId } from '../utils/storage';

export function EndPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room, loading } = useRoom(roomId);
  const playerId = getOrCreatePlayerId();

  if (loading || !room) {
    return (
      <Layout>
        <p className="loading-text">加载中...</p>
      </Layout>
    );
  }

  const slot = getPlayerSlot(room, playerId);
  const won =
    (room.winner === 'player1' && slot === 'player1') ||
    (room.winner === 'player2' && slot === 'player2');
  const draw = !room.winner;

  const handleRestart = async () => {
    if (!roomId) return;
    await restartGame(roomId);
    navigate(`/room/${roomId}/battle`, { replace: true });
  };

  // Auto-navigate to battle when opponent triggers restart
  if (room.status === 'playing') {
    navigate(`/room/${roomId}/battle`, { replace: true });
  }

  return (
    <Layout title="游戏结束">
      <div className="end-page">
        <div className={`end-banner ${won ? 'win' : draw ? 'draw' : 'lose'}`}>
          {won ? '🎉 胜利！' : draw ? '🤝 平局' : '😢 失败'}
        </div>

        <div className="final-hp">
          <p>{room.players.player1?.name ?? '玩家1'}：{room.players.player1?.hp ?? 0} ❤️</p>
          <p>{room.players.player2?.name ?? '玩家2'}：{room.players.player2?.hp ?? 0} ❤️</p>
        </div>

        <button className="btn btn-primary btn-large" onClick={handleRestart}>
          再来一局
        </button>

        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          返回首页
        </button>
      </div>
    </Layout>
  );
}
