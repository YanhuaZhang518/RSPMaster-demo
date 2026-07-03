import { useEffect } from 'react';
import { getCardDisplayName, MOVE_EMOJI, MOVE_LABEL } from '../data/cards';
import type { RoundResult, PlayerSlot } from '../types/game';

interface ResultModalProps {
  result: RoundResult;
  mySlot: PlayerSlot;
  onNext: () => void;
}

const AUTO_ADVANCE_MS = 8000;

export function ResultModal({ result, mySlot, onNext }: ResultModalProps) {
  const myMove = mySlot === 'player1' ? result.player1Move : result.player2Move;
  const oppMove = mySlot === 'player1' ? result.player2Move : result.player1Move;
  const myCardId = mySlot === 'player1' ? result.player1CardId : result.player2CardId;
  const oppCardId = mySlot === 'player1' ? result.player2CardId : result.player1CardId;
  const myDamage = mySlot === 'player1' ? result.player1Damage : result.player2Damage;
  const oppDamage = mySlot === 'player1' ? result.player2Damage : result.player1Damage;
  const myHp = mySlot === 'player1' ? result.player1HpAfter : result.player2HpAfter;
  const oppHp = mySlot === 'player1' ? result.player2HpAfter : result.player1HpAfter;

  const confuse = result.confuseEffect;
  const iUsedConfuse = confuse?.forPlayer === mySlot;
  const iWasConfused = confuse?.targetPlayer === mySlot;

  const moveDisplay = (move: typeof myMove) => {
    if (!move) return '未选择';
    return `${MOVE_EMOJI[move]} ${MOVE_LABEL[move]}`;
  };

  const cardDisplay = (cardId: string | null) => {
    if (!cardId) return '未出牌';
    return getCardDisplayName(cardId);
  };

  useEffect(() => {
    const t = setTimeout(onNext, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [onNext]);

  const rpsLabel = () => {
    if (!result.rpsWinner) return null;
    if (result.rpsWinner === 'draw') return '🤝 猜拳平局';
    const winner = result.rpsWinner === mySlot ? '你' : '对方';
    return `${winner}猜拳胜利`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content result-modal">
        <h2>
          {result.isClashRound ? '⚡ 极速猜拳结算' : `第 ${result.round} 回合结算`}
        </h2>

        {result.clashTriggered && !result.isClashRound && (
          <div className="clash-banner">💥 碎卡！双方卡牌均无效，进入极速猜拳</div>
        )}

        <div className="result-grid">
          <div className="result-col">
            <h3>你</h3>
            <p className="result-move">{moveDisplay(myMove)}</p>
            {iWasConfused && confuse && (
              <p className="confuse-hint">
                🌀 原本 {moveDisplay(confuse.originalMove)} → 被改为 {moveDisplay(confuse.confusedMove)}
              </p>
            )}
            {!result.isClashRound && (
              <p className="result-card">{cardDisplay(myCardId)}</p>
            )}
            <p className={`result-hp ${myDamage > 0 ? 'damaged' : ''}`}>
              ❤️ {myHp} {myDamage > 0 ? `(-${myDamage})` : ''}
            </p>
          </div>

          <div className="result-vs-col">
            <div className="result-vs">VS</div>
            {rpsLabel() && <div className="rps-label">{rpsLabel()}</div>}
          </div>

          <div className="result-col">
            <h3>对方</h3>
            <p className="result-move">{moveDisplay(oppMove)}</p>
            {iUsedConfuse && confuse && (
              <p className="confuse-hint">
                🌀 对方原本 {moveDisplay(confuse.originalMove)} → 被改为 {moveDisplay(confuse.confusedMove)}
              </p>
            )}
            {!result.isClashRound && (
              <p className="result-card">{cardDisplay(oppCardId)}</p>
            )}
            <p className={`result-hp ${oppDamage > 0 ? 'damaged' : ''}`}>
              ❤️ {oppHp} {oppDamage > 0 ? `(-${oppDamage})` : ''}
            </p>
          </div>
        </div>

        {result.details.length > 0 && (
          <div className="result-details">
            {result.details.map((d, i) => (
              <p key={i}>{d}</p>
            ))}
          </div>
        )}

        <button className="btn btn-primary btn-large" onClick={onNext}>
          下一回合
        </button>
        <p className="hint-text auto-advance-hint">{AUTO_ADVANCE_MS / 1000}秒后自动继续</p>
      </div>
    </div>
  );
}
