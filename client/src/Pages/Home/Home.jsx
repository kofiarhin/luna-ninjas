import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./home.styles.scss";

const Home = () => {
  const audioRef = useRef(null);
  const navigate = useNavigate();

  const handleStart = (e) => {
    e.preventDefault();

    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.volume = 1;
      audio.play().catch(() => {});
    }

    setTimeout(() => navigate("/game"), 900);
  };

  return (
    <div className="landing-wrapper">
      <audio ref={audioRef} src="/sounds/correct.mp3" preload="auto" />

      <div className="ninja-bg" aria-hidden="true" />
      <div className="landing-overlay" aria-hidden="true" />
      <div className="landing-noise" aria-hidden="true" />

      <main className="landing-content">
        <div className="landing-badge">Luna Ninjas</div>

        <h1 className="landing-title">
          Master math with{" "}
          <span className="landing-title-accent">ninja quests</span>
        </h1>

        <p className="landing-subtitle">
          Fast rounds. Clean streaks. Level up your skills.
        </p>

        <div className="landing-actions">
          <button className="start-btn" onClick={handleStart}>
            Begin Your Quest
          </button>

          <div className="landing-hint">Tip: headphones on 🔊</div>
        </div>
      </main>
    </div>
  );
};

export default Home;
