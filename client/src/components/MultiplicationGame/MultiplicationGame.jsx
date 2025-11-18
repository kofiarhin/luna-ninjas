import React, { useEffect, useState } from "react";
import "./multiplication-game.styles.scss";

const MultiplicationGame = () => {
  const [question, setQuestion] = useState({ a: 2, b: 2, answer: 4 });
  const [options, setOptions] = useState([4]);
  const [feedback, setFeedback] = useState("");
  const [watermelonVisible, setWatermelonVisible] = useState(false);
  const [watermelonSlice, setWatermelonSlice] = useState(false); // correct animation
  const [watermelonMiss, setWatermelonMiss] = useState(false); // wrong animation
  const [questionCount, setQuestionCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(5);
  const [questionKey, setQuestionKey] = useState(0); // for re-starting question animation
  const [bgFlash, setBgFlash] = useState(false); // background flash on wrong

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
    setQuestionKey((prev) => prev + 1); // force slide-in animation restart
  };

  // first question
  useEffect(() => {
    generateQuestion();
  }, []);

  // timer countdown + timeout handling
  useEffect(() => {
    if (timeLeft <= 0) {
      if (feedback === "correct") return; // already moving on

      setFeedback("timeout");

      const timeoutId = setTimeout(() => {
        setQuestionCount((prev) => prev + 1);
        generateQuestion();
      }, 800);

      return () => clearTimeout(timeoutId);
    }

    const timerId = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [timeLeft, feedback]);

  const handleAnswer = (value) => {
    // ignore clicks if time is up or we’re already showing a correct slice
    if (timeLeft <= 0 || feedback === "correct") return;

    const isCorrect = value === question.answer;

    if (isCorrect) {
      setFeedback("correct");

      setWatermelonVisible(true);
      setWatermelonMiss(false);
      setWatermelonSlice(false);

      // kick off slice animation cleanly
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setWatermelonSlice(true));
      });

      setTimeout(() => {
        setQuestionCount((prev) => prev + 1);
        generateQuestion();
      }, 700);
    } else {
      // wrong: different animation + background flash, no text
      setFeedback(""); // no "Try again" message

      setWatermelonVisible(true);
      setWatermelonSlice(false);
      setWatermelonMiss(true);

      setBgFlash(true);
      setTimeout(() => setBgFlash(false), 220); // quick flash
    }
  };

  const handleSliceAnimationEnd = () => {
    // hide whichever watermelon animation just finished
    setWatermelonVisible(false);
    setWatermelonSlice(false);
    setWatermelonMiss(false);
  };

  return (
    <div className={`game-page ${bgFlash ? "game-page-miss" : ""}`}>
      <div className="game-card">
        <header className="game-header">
          <h1 className="game-title">
            Level: <span>1</span>
          </h1>

          <div className="game-meta">
            <p className="game-subtitle">Question {questionCount + 1}</p>
            <div className={`game-timer ${timeLeft <= 2 ? "timer-low" : ""}`}>
              <span className="timer-label">TIME</span>
              <span className="timer-value">{timeLeft}s</span>
            </div>
          </div>
        </header>

        <div key={questionKey} className="question-block question-animate">
          <span className="question-text">
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
                feedback === "timeout" && opt === question.answer
                  ? "option-timeout"
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
              } ${watermelonMiss ? "watermelon-miss" : ""}`}
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
