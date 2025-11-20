// ChatHistory.jsx
import React from "react";

const ChatHistory = ({ gameHistory = [], levelsMap }) => {
  return (
    <aside className="history-panel">
      <h3 className="history-title">Recent Games</h3>
      {gameHistory.length > 0 ? (
        <ul className="history-list">
          {gameHistory.slice(0, 5).map((game, index) => (
            <li key={game.id || index} className="history-item">
              <div className="history-top-row">
                <span className="history-score">{game.score}</span>
                <span className="history-level-tag">
                  {levelsMap?.[game.level]?.label || game.level}
                </span>
              </div>
              <div className="history-meta-row">
                <span>{game.accuracy}% correct</span>
                <span>
                  {game.correctCount}/{game.totalQuestions}
                </span>
              </div>
              <div className="history-time-row">
                {game.timestamp
                  ? new Date(game.timestamp).toLocaleDateString()
                  : "Invalid Date"}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="history-empty">
          No games played yet. Start playing to see your history!
        </p>
      )}
    </aside>
  );
};

export default ChatHistory;
