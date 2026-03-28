import React from "react";

const GameHeader = ({
  gameActive,
  timeLeft,
  isInitialState,
  score,
  lives,
  streak,
  questionIndex,
  totalQuestions,
  isPaused,
  hasAnswered,
  onPause,
}) => {
  const progress =
    gameActive && totalQuestions > 0
      ? ((questionIndex) / totalQuestions) * 100
      : 0;

  return (
    <div className="gh">
      {/* Top row: stats left, controls right */}
      <div className="gh__top">
        <div className="gh__stats">
          {!isInitialState && (
            <>
              <div className="gh__stat">
                <span className="gh__stat-val">{score}</span>
                <span className="gh__stat-lbl">Score</span>
              </div>
              <div className="gh__stat">
                <span className="gh__stat-val">{lives}</span>
                <span className="gh__stat-lbl">Lives</span>
              </div>
              <div className="gh__stat">
                <span className="gh__stat-val">{streak}</span>
                <span className="gh__stat-lbl">Streak</span>
              </div>
            </>
          )}
        </div>

        {gameActive && (
          <div className="gh__controls">
            {!isPaused && (
              <div className={`gh__timer${timeLeft <= 3 ? " gh__timer--low" : ""}`}>
                <span className="gh__timer-val">{timeLeft}</span>
                <span className="gh__timer-lbl">sec</span>
              </div>
            )}
            {!hasAnswered && !isPaused && (
              <button
                className="gh__pause-btn"
                onClick={onPause}
                aria-label="Pause game"
              >
                Pause
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {gameActive && (
        <div className="gh__progress">
          <div className="gh__progress-track">
            <div
              className="gh__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="gh__progress-text">
            {questionIndex} / {totalQuestions}
          </span>
        </div>
      )}
    </div>
  );
};

export default GameHeader;
