import React, { useEffect, useState } from "react";
import "./multiplication-game.styles.scss";

const QUESTIONS_PER_GAME = 20;
const INITIAL_LIVES = 5;
const STREAK_FOR_EXTRA_LIFE = 5;

const LEVELS = {
  easy: { key: "easy", label: "Easy", timePerQuestion: 8 },
  medium: { key: "medium", label: "Medium", timePerQuestion: 6 },
  ninja: { key: "ninja", label: "Ninja", timePerQuestion: 4 },
};

const MultiplicationGame = () => {
  const [question, setQuestion] = useState({ a: 2, b: 2, answer: 4 });
  const [options, setOptions] = useState([4]);
  const [feedback, setFeedback] = useState("");
  const [watermelonVisible, setWatermelonVisible] = useState(false);
  const [watermelonSlice, setWatermelonSlice] = useState(false);
  const [watermelonMiss, setWatermelonMiss] = useState(false);

  const [questionCount, setQuestionCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionKey, setQuestionKey] = useState(0);
  const [bgFlash, setBgFlash] = useState(false);

  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [streak, setStreak] = useState(0);

  const [selectedLevel, setSelectedLevel] = useState("easy");
  const [currentLevel, setCurrentLevel] = useState("easy");

  const [hasAnswered, setHasAnswered] = useState(false);
  const [questionLog, setQuestionLog] = useState([]);
  const [currentQuestionStartTime, setCurrentQuestionStartTime] =
    useState(null);

  const [gameHistory, setGameHistory] = useState([]);
  const [lastGameSummary, setLastGameSummary] = useState(null);

  const displayLevelKey = currentLevel || selectedLevel;
  const displayLevel = LEVELS[displayLevelKey];

  const loadGameHistory = () => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("multiplicationGameHistory");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const sorted = [...parsed].sort((a, b) => b.score - a.score);
        setGameHistory(sorted);
      }
    } catch {}
  };

  useEffect(() => {
    loadGameHistory();
  }, []);

  const generateQuestion = (levelKeyParam) => {
    const levelKey = levelKeyParam || currentLevel || selectedLevel;
    const levelConfig = LEVELS[levelKey] || LEVELS.easy;
    const timeForQuestion = levelConfig.timePerQuestion;

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
    setHasAnswered(false);
    setTimeLeft(timeForQuestion);
    setQuestionKey((prev) => prev + 1);
    setCurrentQuestionStartTime(Date.now());
  };

  const finishGame = (finalQuestionCount, finalLives, finalScore, finalLog) => {
    setGameActive(false);
    setGameOver(true);

    const correctCount = finalLog.filter((q) => q.isCorrect).length;
    const totalQuestions = finalLog.length;
    const accuracy =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;

    const summary = {
      id: Date.now(),
      timestamp: Date.now(),
      level: currentLevel,
      score: finalScore,
      correctCount,
      totalQuestions,
      accuracy,
      livesRemaining: finalLives,
    };

    setLastGameSummary(summary);

    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("multiplicationGameHistory");
        let parsed = [];
        if (stored) {
          const existing = JSON.parse(stored);
          if (Array.isArray(existing)) parsed = existing;
        }
        const newHistory = [...parsed, { ...summary, history: finalLog }].sort(
          (a, b) => b.score - a.score
        );
        window.localStorage.setItem(
          "multiplicationGameHistory",
          JSON.stringify(newHistory)
        );
        setGameHistory(newHistory);
      } catch {}
    }
  };

  const proceedAfterQuestion = (
    nextQuestionCount,
    nextLives,
    nextScore,
    updatedLog
  ) => {
    if (nextLives <= 0 || nextQuestionCount >= QUESTIONS_PER_GAME) {
      finishGame(nextQuestionCount, nextLives, nextScore, updatedLog);
    } else {
      generateQuestion();
    }
  };

  const handleStartGame = () => {
    const levelKey = selectedLevel;

    setCurrentLevel(levelKey);
    setScore(0);
    setLives(INITIAL_LIVES);
    setStreak(0);
    setQuestionCount(0);
    setQuestionLog([]);
    setFeedback("");
    setWatermelonVisible(false);
    setWatermelonSlice(false);
    setWatermelonMiss(false);
    setGameOver(false);
    setGameActive(true);
    setHasAnswered(false);

    generateQuestion(levelKey);
  };

  const handleTimeout = () => {
    if (!gameActive || hasAnswered) return;
    setHasAnswered(true);
    setFeedback("timeout");

    const timeTaken = currentQuestionStartTime
      ? (Date.now() - currentQuestionStartTime) / 1000
      : null;

    const newLives = lives - 1;
    const newStreak = 0;
    const newScore = score;
    const newQuestionCount = questionCount + 1;

    setWatermelonVisible(true);
    setWatermelonSlice(false);
    setWatermelonMiss(true);

    setBgFlash(true);
    setTimeout(() => setBgFlash(false), 220);

    const questionEntry = {
      a: question.a,
      b: question.b,
      correctAnswer: question.answer,
      userAnswer: null,
      isCorrect: false,
      timeTaken,
      level: currentLevel,
      outcome: "timeout",
    };

    const updatedLog = [...questionLog, questionEntry];

    setQuestionLog(updatedLog);
    setLives(newLives);
    setStreak(newStreak);
    setScore(newScore);
    setQuestionCount(newQuestionCount);

    setTimeout(() => {
      proceedAfterQuestion(newQuestionCount, newLives, newScore, updatedLog);
    }, 900);
  };

  useEffect(() => {
    if (!gameActive) return;
    if (hasAnswered) return;

    if (timeLeft <= 0) {
      handleTimeout();
      return;
    }

    const timerId = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [timeLeft, gameActive, hasAnswered]);

  const handleAnswer = (value) => {
    if (!gameActive || hasAnswered || timeLeft <= 0) return;

    const isCorrect = value === question.answer;
    setHasAnswered(true);

    const timeTaken = currentQuestionStartTime
      ? (Date.now() - currentQuestionStartTime) / 1000
      : null;

    let newLives = lives;
    let newScore = score;
    let newStreak = streak;
    let newFeedback = "";

    if (isCorrect) {
      newFeedback = "correct";
      newScore = score + 10;
      newStreak = streak + 1;

      if (newStreak > 0 && newStreak % STREAK_FOR_EXTRA_LIFE === 0) {
        newLives = lives + 1;
      }

      setWatermelonVisible(true);
      setWatermelonMiss(false);
      setWatermelonSlice(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => setWatermelonSlice(true));
      });
    } else {
      newFeedback = "wrong";
      newLives = lives - 1;
      newStreak = 0;

      setWatermelonVisible(true);
      setWatermelonSlice(false);
      setWatermelonMiss(true);

      setBgFlash(true);
      setTimeout(() => setBgFlash(false), 220);
    }

    const newQuestionCount = questionCount + 1;

    const questionEntry = {
      a: question.a,
      b: question.b,
      correctAnswer: question.answer,
      userAnswer: value,
      isCorrect,
      timeTaken,
      level: currentLevel,
      outcome: isCorrect ? "correct" : "wrong",
    };

    const updatedLog = [...questionLog, questionEntry];

    setFeedback(newFeedback);
    setQuestionLog(updatedLog);
    setLives(newLives);
    setScore(newScore);
    setStreak(newStreak);
    setQuestionCount(newQuestionCount);

    const delay = isCorrect ? 700 : 900;

    setTimeout(() => {
      proceedAfterQuestion(newQuestionCount, newLives, newScore, updatedLog);
    }, delay);
  };

  const handleSliceAnimationEnd = () => {
    setWatermelonVisible(false);
    setWatermelonSlice(false);
    setWatermelonMiss(false);
  };

  const handleLevelChange = (levelKey) => {
    if (gameActive) return;
    setSelectedLevel(levelKey);
  };

  const handlePlayAgain = () => {
    handleStartGame();
  };

  const isInitialState = !gameActive && !gameOver && questionCount === 0;
  const showHistory = !gameActive;

  return (
    <div className={`game-page ${bgFlash ? "game-page-miss" : ""}`}>
      <div className={`game-shell ${gameActive ? "game-shell-centered" : ""}`}>
        <div className="game-card">
          {/* Game Header */}
          <div className="game-header">
            <div className="game-header-left">
              <h1 className="game-title">
                times<span>ninja</span>
              </h1>
              <div className="game-subtitle">Train your mind</div>
            </div>
            <div className="game-header-right">
              {gameActive && (
                <div
                  className={`game-timer ${timeLeft <= 3 ? "timer-low" : ""}`}
                >
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

          {/* Level Selection */}
          {isInitialState && (
            <div className="level-select">
              {Object.values(LEVELS).map((level) => (
                <button
                  key={level.key}
                  className={`level-button ${
                    selectedLevel === level.key ? "level-active" : ""
                  }`}
                  onClick={() => handleLevelChange(level.key)}
                >
                  {level.label}
                </button>
              ))}
            </div>
          )}

          {/* Question */}
          {gameActive && (
            <div className="question-block">
              <div
                className={`question-text ${
                  hasAnswered ? "question-text-muted" : ""
                }`}
                key={questionKey}
              >
                {question.a} × {question.b} = ?
              </div>
            </div>
          )}

          {/* Answer Options */}
          {gameActive ? (
            <div
              className={`options-grid ${hasAnswered ? "" : "options-animate"}`}
            >
              {options.map((value, index) => (
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
          ) : (
            <div className="options-placeholder">
              Choose your difficulty level above, then click Start Game to begin
              training your multiplication skills!
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div className={`feedback-text feedback-${feedback}`}>
              {feedback === "correct"
                ? "Correct! 🥒"
                : feedback === "wrong"
                ? "Oops! Wrong answer"
                : feedback === "timeout"
                ? "Time's up!"
                : ""}
            </div>
          )}

          {/* Game Controls */}
          <div className="game-controls-row">
            <button
              className="start-button"
              onClick={handleStartGame}
              disabled={gameActive}
            >
              {isInitialState ? "Start Game" : "Play Again"}
            </button>
          </div>

          {/* Game Summary */}
          {gameOver && lastGameSummary && (
            <div className="game-summary">
              <div className="summary-line">
                <span>Final Score</span>
                <span className="summary-value">{lastGameSummary.score}</span>
              </div>
              <div className="summary-line">
                <span>Accuracy</span>
                <span className="summary-value">
                  {lastGameSummary.accuracy}%
                </span>
              </div>
              <div className="summary-line">
                <span>Lives Remaining</span>
                <span className="summary-value">
                  {lastGameSummary.livesRemaining}
                </span>
              </div>
              <div className="summary-line">
                <span>Questions Answered</span>
                <span className="summary-value">
                  {lastGameSummary.totalQuestions}
                </span>
              </div>
            </div>
          )}

          {/* Watermelon Animation Layer */}
          {watermelonVisible && (
            <div className="watermelon-layer">
              <div
                className={`watermelon ${
                  watermelonSlice ? "watermelon-slice" : ""
                } ${watermelonMiss ? "watermelon-miss" : ""}`}
                onAnimationEnd={handleSliceAnimationEnd}
              >
                <div className="watermelon-halo"></div>
                <div className="watermelon-half watermelon-left"></div>
                <div className="watermelon-half watermelon-right"></div>
                {watermelonSlice && (
                  <div className="watermelon-slash-line"></div>
                )}
              </div>
            </div>
          )}
        </div>

        {showHistory && (
          <aside className="history-panel">
            <h3 className="history-title">Recent Games</h3>
            {gameHistory.length > 0 ? (
              <ul className="history-list">
                {gameHistory.slice(0, 5).map((game, index) => (
                  <li key={game.id || index} className="history-item">
                    <div className="history-top-row">
                      <span className="history-score">{game.score}</span>
                      <span className="history-level-tag">
                        {LEVELS[game.level]?.label || game.level}
                      </span>
                    </div>
                    <div className="history-meta-row">
                      <span>{game.accuracy}% correct</span>
                      <span>
                        {game.correctCount}/{game.totalQuestions}
                      </span>
                    </div>
                    <div className="history-time-row">
                      {new Date(game.timestamp).toLocaleDateString()}
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
        )}
      </div>
    </div>
  );
};

export default MultiplicationGame;
