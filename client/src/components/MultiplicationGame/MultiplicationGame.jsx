import React, { useEffect, useState } from "react";
import "./multiplication-game.styles.scss";

const MultiplicationGame = () => {
  const [question, setQuestion] = useState({ a: 2, b: 2, answer: 4 });
  const [options, setOptions] = useState([4]);
  const [feedback, setFeedback] = useState("");
  const [watermelonVisible, setWatermelonVisible] = useState(false);
  const [watermelonSlice, setWatermelonSlice] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(5);
  const [wrongFlash, setWrongFlash] = useState(false);

  const generateQuestion = () => {
    const a = Math.floor(Math.random() * 12) + 1;
    const b = Math.floor(Math.random() * 12) + 1;
    const correct = a * b;

    const opts = new Set();
    opts.add(correct);

    while (opts.size < 5) {
      const offset = Math.floor(Math.random() * 11) - 5;
      let fake = correct + offset * (Math.floor(Math.random() * 3) + 1);
      if (fake <= 0 || fake === correct) {
        fake = Math.floor(Math.random() * 144) + 1;
      }
      opts.add(fake);
    }

    const shuffled = Array.from(opts).sort(() => Math.random() - 0.5);

    setQuestion({ a, b, answer: correct });
    setOptions(shuffled);
    setFeedback("");
    setTimeLeft(5);
  };

  useEffect(() => {
    generateQuestion();
  }, []);

  // timer countdown + timeout handling
  useEffect(() => {
    if (timeLeft === 0) {
      setFeedback("timeout");

      setTimeout(() => {
        setQuestionCount((prev) => prev + 1);
        generateQuestion();
      }, 800);
      return;
    }

    const timerId = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [timeLeft]);

  const handleAnswer = (value) => {
    const isCorrect = value === question.answer;

    if (isCorrect) {
      setFeedback("correct");
      setWatermelonVisible(true);
      setWatermelonSlice(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => setWatermelonSlice(true));
      });

      setTimeout(() => {
        setQuestionCount((prev) => prev + 1);
        generateQuestion();
      }, 700);
    } else {
      setFeedback("wrong");
      setWatermelonVisible(true);
      setWatermelonSlice(false);

      // background flash on wrong
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 260);

      // hide feedback/animation shortly after
      setTimeout(() => {
        setFeedback("");
        setWatermelonVisible(false);
      }, 650);
    }
  };

  const handleSliceAnimationEnd = () => {
    // hide after correct slice animation finishes
    if (feedback === "correct") {
      setWatermelonVisible(false);
      setWatermelonSlice(false);
    }
  };

  return (
    <div className={`game-page ${wrongFlash ? "game-page-wrong" : ""}`}>
      <div className="game-card">
        <header className="game-header">
          <div className="game-header-left">
            <h1 className="game-title">
              Level: <span>1</span>
            </h1>
          </div>

          <div className="game-header-right">
            <p className="game-subtitle">Question {questionCount + 1}</p>
            <div className={`game-timer ${timeLeft <= 2 ? "timer-low" : ""}`}>
              <span className="timer-label">Time</span>
              <span className="timer-value">{timeLeft}s</span>
            </div>
          </div>
        </header>

        <div className="question-block">
          <span key={questionCount} className="question-text">
            {question.a} × {question.b}
          </span>
        </div>

        <div className="options-grid">
          {options.map((opt) => (
            <button
              key={opt}
              className={`option-button ${
                feedback === "correct" && opt === question.answer
                  ? "option-correct"
                  : ""
              } ${
                feedback === "wrong" && opt !== question.answer
                  ? "option-fade"
                  : ""
              }`}
              onClick={() => handleAnswer(opt)}
            >
              {opt}
            </button>
          ))}
        </div>

        <div
          className={`feedback-text ${
            feedback === "correct" ? "feedback-correct" : ""
          } ${feedback === "timeout" ? "feedback-timeout" : ""}`}
        >
          {feedback === "correct" && "Nice slash, ninja!"}
          {feedback === "timeout" && "Time's up!"}
        </div>

        <div className="watermelon-layer">
          {watermelonVisible && (
            <div
              className={`watermelon ${
                watermelonSlice ? "watermelon-slice" : ""
              } ${feedback === "wrong" ? "watermelon-wobble" : ""}`}
              onAnimationEnd={handleSliceAnimationEnd}
            >
              <div className="watermelon-halo" />
              <div className="watermelon-half watermelon-left" />
              <div className="watermelon-half watermelon-right" />
              <div className="watermelon-slash-line" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiplicationGame;
