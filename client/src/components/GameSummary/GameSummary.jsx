import React from "react";

const GameSummary = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="gs">
      <h2 className="gs__title">Game Over</h2>

      <div className="gs__grid">
        <div className="gs__card gs__card--score">
          <span className="gs__card-val">{summary.score}</span>
          <span className="gs__card-lbl">Final Score</span>
        </div>
        <div className="gs__card gs__card--accuracy">
          <span className="gs__card-val">{summary.accuracy}%</span>
          <span className="gs__card-lbl">Accuracy</span>
        </div>
        <div className="gs__card">
          <span className="gs__card-val">{summary.livesRemaining}</span>
          <span className="gs__card-lbl">Lives Left</span>
        </div>
        <div className="gs__card">
          <span className="gs__card-val">{summary.totalQuestions}</span>
          <span className="gs__card-lbl">Answered</span>
        </div>
      </div>
    </div>
  );
};

export default GameSummary;
