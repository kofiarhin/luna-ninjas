import React from "react";

const QuestionDisplay = ({ question, hasAnswered, questionKey }) => {
  return (
    <div className="question-block" key={questionKey}>
      <p className={`question-text${hasAnswered ? " question-text--muted" : ""}`}>
        {question.questionText
          ? question.questionText
          : `${question.a} × ${question.b} = ?`}
      </p>
    </div>
  );
};

export default QuestionDisplay;
