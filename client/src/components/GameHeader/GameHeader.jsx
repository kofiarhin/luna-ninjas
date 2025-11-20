// GameHeader.jsx
import React from "react";

const GameHeader = ({
  gameActive,
  timeLeft,
  displayLevel,
  isInitialState,
  score,
  lives,
  streak,
}) => {
  return (
    <div className="game-header">
      <div className="game-header-left">
        <h1 className="game-title">
          times<span>ninja</span>
        </h1>
        <div className="game-subtitle">Train your mind</div>
      </div>

      <div className="game-header-right">
        {gameActive && (
          <div className={`game-timer ${timeLeft <= 3 ? "timer-low" : ""}`}>
            <span className="timer-label">time</span>
            <span className="timer-value">{timeLeft}s</span>
          </div>
        )}

        <div className="game-meta">
          <div className="game-subtitle">{displayLevel.label}</div>

          {!isInitialState && (
            <div className="game-stats">
              <div className="stat-pill">
                <span className="stat-label">score</span>
                <span className="stat-value">{score}</span>
              </div>
              <div className="stat-pill">
                <span className="stat-label">lives</span>
                <span className="stat-value">{lives}</span>
              </div>
              <div className="stat-pill">
                <span className="stat-label">streak</span>
                <span className="stat-value">{streak}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameHeader;
