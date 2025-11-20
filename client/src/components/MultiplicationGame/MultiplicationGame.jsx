// MultiplicationGame.jsx
import React, { useEffect, useState, useRef } from "react";
import "./multiplication-game.styles.scss";

import GameHeader from "../GameHeader/GameHeader";
import QuestionDisplay from "../QuestionDisplay/QuestionDisplay";
import AnswerOptions from "../AnswerOptions/AnswerOptions";
import GameSummary from "../GameSummary/GameSummary";
import ChatHistory from "../ChatHistory/ChatHistory";
import WatermelonAnimation from "../WatermelonAnimation/WatermelonAnimation";

const QUESTIONS_PER_GAME = 20;
const INITIAL_LIVES = 5;
const STREAK_FOR_EXTRA_LIFE = 5;

const LEVELS = {
  easy: { key: "easy", label: "Easy", timePerQuestion: 8 },
  medium: { key: "medium", label: "Medium", timePerQuestion: 6 },
  ninja: { key: "ninja", label: "Ninja", timePerQuestion: 4 },
};

const MultiplicationGame = ({ questions: initialQuestions = [] }) => {
  // sounds
  const correctSoundRef = useRef(null);
  const wrongSoundRef = useRef(null);

  // questions (from props)
  const [questions, setQuestions] = useState(initialQuestions);

  // game state
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

  // sync questions when prop changes
  useEffect(() => {
    setQuestions(initialQuestions || []);
  }, [initialQuestions]);

  // sounds preload
  useEffect(() => {
    correctSoundRef.current = new Audio("/sounds/correct.mpeg");
    wrongSoundRef.current = new Audio("/sounds/wrong.mpeg");
  }, []);

  const playSound = (audioRef) => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.play();
    } catch {
      // ignore autoplay errors
    }
  };

  // ---------- history helpers ----------
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

  useEffect(() => {
    loadGameHistory();
  }, []);

  // ---------- game logic ----------
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
      } catch {
        // ignore
      }
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

  const handleStartGame = () => {
    if (!questions.length) return;

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

    playSound(wrongSoundRef);

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

      playSound(correctSoundRef);

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

      playSound(wrongSoundRef);

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

  const startDisabled = gameActive || !questions.length;

  // ---------- UI ----------
  return (
    <div className={`game-page ${bgFlash ? "game-page-miss" : ""}`}>
      <div className={`game-shell ${gameActive ? "game-shell-centered" : ""}`}>
        <div className="game-card">
          <GameHeader
            gameActive={gameActive}
            timeLeft={timeLeft}
            displayLevel={displayLevel}
            isInitialState={isInitialState}
            score={score}
            lives={lives}
            streak={streak}
          />

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
            <QuestionDisplay
              question={question}
              hasAnswered={hasAnswered}
              questionKey={questionKey}
            />
          )}

          {gameActive ? (
            <AnswerOptions
              options={options}
              feedback={feedback}
              question={question}
              hasAnswered={hasAnswered}
              handleAnswer={handleAnswer}
              questionKey={questionKey}
            />
          ) : (
            <div className="options-placeholder">
              {!questions.length &&
                "No questions available. Please provide questions as a prop."}
              {questions.length > 0 &&
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

          {gameOver && <GameSummary summary={lastGameSummary} />}

          <WatermelonAnimation
            visible={watermelonVisible}
            slice={watermelonSlice}
            miss={watermelonMiss}
            onAnimationEnd={handleSliceAnimationEnd}
          />
        </div>

        {showHistoryPanel && (
          <ChatHistory gameHistory={gameHistory} levelsMap={LEVELS} />
        )}
      </div>
    </div>
  );
};

export default MultiplicationGame;
