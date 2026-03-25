// MultiplicationGame.jsx
import React, { useEffect, useState, useRef } from "react";
import "./multiplication-game.styles.scss";

import GameHeader from "../GameHeader/GameHeader";
import QuestionDisplay from "../QuestionDisplay/QuestionDisplay";
import AnswerOptions from "../AnswerOptions/AnswerOptions";
import GameSummary from "../GameSummary/GameSummary";
import WatermelonAnimation from "../WatermelonAnimation/WatermelonAnimation";

import { generateRound } from "../../utils/questionGenerator";
import { getPointsPerCorrect } from "../../utils/scoring";
import useSubmitScore from "../../hooks/useSubmitScore";

const QUESTIONS_PER_GAME = 12;
const INITIAL_LIVES = 5;
const STREAK_FOR_EXTRA_LIFE = 5;
const TIME_PER_QUESTION = 8; // fixed 8-second timer

// Minimal level descriptor for GameHeader (which expects displayLevel.label)
const DISPLAY_LEVEL = { label: "" };

/**
 * Props:
 *   table      {number}   - The selected times table (2–12)
 *   onPlayAgain {Function} - Called when user clicks Play Again (returns to table selection)
 */
const MultiplicationGame = ({ table, onPlayAgain }) => {
  // sounds
  const correctSoundRef = useRef(null);
  const wrongSoundRef = useRef(null);

  // questions for this round (generated fresh on game start)
  const [questions, setQuestions] = useState([]);

  // game state
  const [question, setQuestion] = useState({
    id: null,
    a: table,
    b: 1,
    answer: table,
    questionText: "",
  });
  const [options, setOptions] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [watermelonVisible, setWatermelonVisible] = useState(false);
  const [watermelonSlice, setWatermelonSlice] = useState(false);
  const [watermelonMiss, setWatermelonMiss] = useState(false);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionKey, setQuestionKey] = useState(0);
  const [bgFlash, setBgFlash] = useState(false);

  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [streak, setStreak] = useState(0);

  const [hasAnswered, setHasAnswered] = useState(false);
  const [questionLog, setQuestionLog] = useState([]);
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState(null);

  const [lastGameSummary, setLastGameSummary] = useState(null);

  // Score submission
  const { submit, loading: submitLoading, error: submitError } = useSubmitScore();
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // Hold round data for retry
  const pendingScoreRef = useRef(null);

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

  // ---------- question display helpers ----------
  const showQuestion = (questionsArr, index, levelKey) => {
    if (index >= questionsArr.length) return;

    const q = questionsArr[index];

    setQuestion({
      id: `${q.a}-${q.b}-${index}`,
      a: q.a,
      b: q.b,
      answer: q.correctAnswer,
      questionText: q.questionText,
    });
    setOptions(q.options);
    setFeedback("");
    setHasAnswered(false);
    setTimeLeft(TIME_PER_QUESTION);
    setQuestionKey((prev) => prev + 1);
    setCurrentQuestionStartTime(Date.now());
  };

  // ---------- score submission ----------
  const submitScore = async (finalCorrectCount) => {
    setSubmitAttempted(true);
    setSubmitSuccess(false);
    pendingScoreRef.current = { table, correctCount: finalCorrectCount };

    try {
      await submit({ table, correctCount: finalCorrectCount });
      setSubmitSuccess(true);
    } catch {
      // error is stored in submitError from the hook
    }
  };

  const handleRetrySubmit = () => {
    if (!pendingScoreRef.current) return;
    submitScore(pendingScoreRef.current.correctCount);
  };

  // ---------- game logic ----------
  const finishGame = (nextQuestionIndex, nextLives, nextScore, updatedLog) => {
    setGameActive(false);
    setGameOver(true);

    const correctCount = updatedLog.filter((q) => q.isCorrect).length;
    const totalQuestions = updatedLog.length;
    const accuracy =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;

    const summary = {
      id: Date.now(),
      timestamp: Date.now(),
      table,
      score: nextScore,
      correctCount,
      totalQuestions,
      accuracy,
      livesRemaining: nextLives,
    };

    setLastGameSummary(summary);
    submitScore(correctCount);
  };

  const proceedAfterQuestion = (
    nextQuestionIndex,
    nextLives,
    nextScore,
    updatedLog
  ) => {
    if (nextLives <= 0 || nextQuestionIndex >= QUESTIONS_PER_GAME) {
      finishGame(nextQuestionIndex, nextLives, nextScore, updatedLog);
    } else {
      showQuestion(questions, nextQuestionIndex, null);
      setQuestionIndex(nextQuestionIndex);
    }
  };

  const handleStartGame = () => {
    const freshQuestions = generateRound(table);

    setQuestions(freshQuestions);
    setScore(0);
    setLives(INITIAL_LIVES);
    setStreak(0);
    setQuestionIndex(0);
    setQuestionLog([]);
    setFeedback("");
    setWatermelonVisible(false);
    setWatermelonSlice(false);
    setWatermelonMiss(false);
    setGameOver(false);
    setGameActive(true);
    setHasAnswered(false);
    setLastGameSummary(null);
    setSubmitAttempted(false);
    setSubmitSuccess(false);
    pendingScoreRef.current = null;

    // Show first question from freshly generated set
    const q = freshQuestions[0];
    setQuestion({
      id: `${q.a}-${q.b}-0`,
      a: q.a,
      b: q.b,
      answer: q.correctAnswer,
      questionText: q.questionText,
    });
    setOptions(q.options);
    setTimeLeft(TIME_PER_QUESTION);
    setQuestionKey((prev) => prev + 1);
    setCurrentQuestionStartTime(Date.now());
  };

  const handleTimeout = () => {
    if (!gameActive || hasAnswered) return;
    setHasAnswered(true);
    setFeedback("timeout");

    playSound(wrongSoundRef);

    const timeTaken = currentQuestionStartTime
      ? (Date.now() - currentQuestionStartTime) / 1000
      : null;

    const newLives = lives - 1;
    const newStreak = 0;
    const newScore = score;
    const newQuestionIndex = questionIndex + 1;

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
      outcome: "timeout",
    };

    const updatedLog = [...questionLog, questionEntry];

    setQuestionLog(updatedLog);
    setLives(newLives);
    setStreak(newStreak);
    setScore(newScore);

    setTimeout(() => {
      proceedAfterQuestion(newQuestionIndex, newLives, newScore, updatedLog);
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

    const pointsPerCorrect = getPointsPerCorrect(table);

    let newLives = lives;
    let newScore = score;
    let newStreak = streak;
    let newFeedback = "";

    if (isCorrect) {
      newFeedback = "correct";
      newScore = score + pointsPerCorrect;
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
    }

    const newQuestionIndex = questionIndex + 1;

    const questionEntry = {
      id: question.id,
      a: question.a,
      b: question.b,
      correctAnswer: question.answer,
      userAnswer: value,
      isCorrect,
      timeTaken,
      outcome: isCorrect ? "correct" : "wrong",
    };

    const updatedLog = [...questionLog, questionEntry];

    setFeedback(newFeedback);
    setQuestionLog(updatedLog);
    setLives(newLives);
    setScore(newScore);
    setStreak(newStreak);

    const delay = isCorrect ? 700 : 900;

    setTimeout(() => {
      proceedAfterQuestion(newQuestionIndex, newLives, newScore, updatedLog);
    }, delay);
  };

  const handleSliceAnimationEnd = () => {
    setWatermelonVisible(false);
    setWatermelonSlice(false);
    setWatermelonMiss(false);
  };

  const handlePlayAgain = () => {
    // Return to table selection in Game.jsx
    if (onPlayAgain) onPlayAgain();
  };

  const isInitialState = !gameActive && !gameOver;

  // ---------- UI ----------
  return (
    <div className={`game-page ${bgFlash ? "game-page-miss" : ""}`}>
      <div className={`game-shell ${gameActive ? "game-shell-centered" : ""}`}>
        <div className="game-card">
          <GameHeader
            gameActive={gameActive}
            timeLeft={timeLeft}
            displayLevel={DISPLAY_LEVEL}
            isInitialState={isInitialState}
            score={score}
            lives={lives}
            streak={streak}
          />

          {isInitialState && (
            <div className="level-select">
              <div className="table-ready">
                <p className="table-ready__chosen">
                  You chose: <strong>&times;{table}</strong>
                </p>
                <p className="table-ready__pts">
                  {getPointsPerCorrect(table)} pts per correct answer
                </p>
              </div>
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
            !gameOver && (
              <div className="options-placeholder">
                Click Start Game to begin!
              </div>
            )
          )}

          {feedback && (
            <div className={`feedback-text feedback-${feedback}`}>
              {feedback === "correct"
                ? "Correct!"
                : feedback === "wrong"
                ? "Oops! Wrong answer"
                : feedback === "timeout"
                ? "Time's up!"
                : ""}
            </div>
          )}

          {!gameOver && (
            <div className="game-controls-row">
              {isInitialState && (
                <button
                  className="start-button"
                  onClick={handleStartGame}
                >
                  Start Game
                </button>
              )}
            </div>
          )}

          {gameOver && (
            <>
              <GameSummary summary={lastGameSummary} />

              <div className="score-submission">
                {submitAttempted && submitLoading && (
                  <p className="score-submission__status">Saving score...</p>
                )}
                {submitAttempted && !submitLoading && submitSuccess && (
                  <p className="score-submission__status score-submission__status--success">
                    Score saved!
                  </p>
                )}
                {submitAttempted && !submitLoading && submitError && (
                  <div className="score-submission__error">
                    <p>Could not save score — {submitError}</p>
                    <button
                      className="score-submission__retry"
                      onClick={handleRetrySubmit}
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>

              <div className="game-controls-row">
                <button className="start-button" onClick={handlePlayAgain}>
                  Play Again
                </button>
              </div>
            </>
          )}

          <WatermelonAnimation
            visible={watermelonVisible}
            slice={watermelonSlice}
            miss={watermelonMiss}
            onAnimationEnd={handleSliceAnimationEnd}
          />
        </div>
      </div>
    </div>
  );
};

export default MultiplicationGame;
