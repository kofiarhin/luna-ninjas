// GameSummary.jsx
import React from "react";

const GameSummary = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="game-summary">
      <div className="summary-line">
        <span>Final Score</span>
        <span className="summary-value">{summary.score}</span>
      </div>

      <div className="summary-line">
        <span>Accuracy</span>
        <span className="summary-value">{summary.accuracy}%</span>
      </div>

      <div className="summary-line">
        <span>Lives Remaining</span>
        <span className="summary-value">{summary.livesRemaining}</span>
      </div>

      <div className="summary-line">
        <span>Questions Answered</span>
        <span className="summary-value">{summary.totalQuestions}</span>
      </div>
    </div>
  );
};

export default GameSummary;
