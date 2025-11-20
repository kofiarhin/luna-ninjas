// AnswerOptions.jsx
import React from "react";

const AnswerOptions = ({
  options,
  feedback,
  question,
  hasAnswered,
  handleAnswer,
  questionKey,
}) => {
  return (
    <div className={`options-grid ${hasAnswered ? "" : "options-animate"}`}>
      {options.map((value) => (
        <button
          key={`${questionKey}-${value}`}
          className={`option-button ${
            feedback === "correct" && value === question.answer
              ? "option-correct"
              : feedback === "wrong" && value === question.answer
              ? "option-reveal"
              : ""
          }`}
          onClick={() => handleAnswer(value)}
          disabled={hasAnswered}
        >
          {value}
        </button>
      ))}
    </div>
  );
};

export default AnswerOptions;
