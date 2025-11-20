// MultiplicationGame.jsx
import React, { useEffect, useState } from "react";
import { BASE_URL } from "../../constants/constans";
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
  // fetched questions
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // game state (same as before)
  const [question, setQuestion] = useState({
    id: null,
    a: 2,
    b: 2,
    answer: 4,
    questionText: "",
    hint: "",
  });
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

  const [showHint, setShowHint] = useState(false);

  const displayLevelKey = currentLevel || selectedLevel;
  const displayLevel = LEVELS[displayLevelKey];

  // ---------- helpers ----------

  const getStoredHistory = () => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("multiplicationGameHistory");
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const loadGameHistory = () => {
    const parsed = getStoredHistory();
    if (parsed.length) {
      const sorted = [...parsed].sort((a, b) => b.score - a.score);
      setGameHistory(sorted);
    }
  };

  // 🔥 MAIN FETCH: include chat/game history in the request
  const fetchQuestionsWithHistory = async () => {
    setLoadingQuestions(true);
    setFetchError(null);

    const history = getStoredHistory();

    try {
      const res = await fetch(`${BASE_URL}/api/questions`, {
        method: "POST", // switch to POST so we can send body
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ history }), // <--- send history to server
      });

      if (!res.ok) {
        throw new Error("Failed to load questions");
      }

      const payload = await res.json();
      console.log("questions payload:", payload);

      const fetched = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
        ? payload
        : [];

      setQuestions(fetched);
      setLoadingQuestions(false);
    } catch (err) {
      console.error(err);
      setFetchError(err.message || "Error loading questions");
      setLoadingQuestions(false);
    }
  };

  // initial mount: load history + fetch first batch of questions
  useEffect(() => {
    loadGameHistory();
    fetchQuestionsWithHistory();
  }, []);

  // ---------- game logic (unchanged except where noted) ----------

  const generateQuestion = (levelKeyParam) => {
    if (!questions.length) return;

    const levelKey = levelKeyParam || currentLevel || selectedLevel;
    const levelConfig = LEVELS[levelKey] || LEVELS.easy;
    const timeForQuestion = levelConfig.timePerQuestion;

    const randomIndex = Math.floor(Math.random() * questions.length);
    const q = questions[randomIndex];

    const correct = q.correctAnswer;
    const rawOptions = [correct, ...(q.wrongAnswers || [])];
    const uniqueOptions = Array.from(new Set(rawOptions));
    const shuffled = uniqueOptions.sort(() => Math.random() - 0.5);

    setQuestion({
      id: q.id,
      a: q.a,
      b: q.b,
      answer: correct,
      questionText: q.questionText,
      hint: q.hint,
    });
    setOptions(shuffled);
    setFeedback("");
    setShowHint(false);
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
    const maxQuestions = Math.min(QUESTIONS_PER_GAME, questions.length || 0);
    if (nextLives <= 0 || nextQuestionCount >= maxQuestions) {
      finishGame(nextQuestionCount, nextLives, nextScore, updatedLog);
    } else {
      generateQuestion();
    }
  };

  // 🔥 make start game async so it can refresh questions with latest history
  const handleStartGame = async () => {
    // always refresh questions so server can adapt to latest history
    await fetchQuestionsWithHistory();

    if (!questions.length && !loadingQuestions) return;

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
    setShowHint(false);

    generateQuestion(levelKey);
  };

  const handleTimeout = () => {
    if (!gameActive || hasAnswered) return;
    setHasAnswered(true);
    setFeedback("timeout");
    setShowHint(true);

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
      id: question.id,
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
  }, [timeLeft, gameActive, hasAnswered]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setShowHint(true);
    }

    const newQuestionCount = questionCount + 1;

    const questionEntry = {
      id: question.id,
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
  const showHistoryPanel = !gameActive;

  const startDisabled =
    gameActive || loadingQuestions || !!fetchError || !questions.length;

  // ---------- UI (same as before) ----------
  return (
    <div className={`game-page ${bgFlash ? "game-page-miss" : ""}`}>
      <div className={`game-shell ${gameActive ? "game-shell-centered" : ""}`}>
        <div className="game-card">
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

          {gameActive && (
            <div className="question-block">
              <div
                className={`question-text ${
                  hasAnswered ? "question-text-muted" : ""
                }`}
                key={questionKey}
              >
                {question.questionText
                  ? question.questionText
                  : `${question.a} × ${question.b} = ?`}
              </div>
            </div>
          )}

          {gameActive ? (
            <div
              className={`options-grid ${hasAnswered ? "" : "options-animate"}`}
            >
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
          ) : (
            <div className="options-placeholder">
              {loadingQuestions && "Loading questions..."}
              {fetchError && !loadingQuestions && (
                <span>Error: {fetchError}</span>
              )}
              {!loadingQuestions &&
                !fetchError &&
                !questions.length &&
                "No questions available."}
              {!loadingQuestions &&
                !fetchError &&
                questions.length > 0 &&
                "Choose your difficulty level above, then click Start Game to begin training your multiplication skills!"}
            </div>
          )}

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

          {showHint && question.hint && (
            <div className="hint-text">Hint: {question.hint}</div>
          )}

          <div className="game-controls-row">
            <button
              className="start-button"
              onClick={isInitialState ? handleStartGame : handlePlayAgain}
              disabled={startDisabled}
            >
              {isInitialState ? "Start Game" : "Play Again"}
            </button>
          </div>

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

        {showHistoryPanel && (
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
                      {game.timestamp
                        ? new Date(game.timestamp).toLocaleDateString()
                        : "Invalid Date"}
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
