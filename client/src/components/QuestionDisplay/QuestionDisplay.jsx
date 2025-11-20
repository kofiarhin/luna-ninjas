// QuestionDisplay.jsx
import React from "react";

const QuestionDisplay = ({ question, hasAnswered, questionKey }) => {
  return (
    <div className="question-block">
      <div
        className={`question-text ${hasAnswered ? "question-text-muted" : ""}`}
        key={questionKey}
      >
        {question.questionText
          ? question.questionText
          : `${question.a} × ${question.b} = ?`}
      </div>
    </div>
  );
};

export default QuestionDisplay;
