import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./home.styles.scss";

const Home = () => {
  const audioRef = useRef(null);
  const navigate = useNavigate();

  const handleStart = (e) => {
    e.preventDefault();

    if (audioRef.current) {
      audioRef.current.currentTime = 0; // restart from beginning
      audioRef.current.volume = 1;

      audioRef.current.play().catch((err) => {
        console.error("Audio play error:", err);
      });
    }

    // small delay so you actually hear the sound
    setTimeout(() => {
      navigate("/game");
    }, 1700);
  };

  return (
    <div className="landing-wrapper">
      {/* file must be: client/public/sounds/correct.mpeg */}
      <audio ref={audioRef} src="/sounds/correct.mp3" preload="auto" />

      <div className="landing-content fade-in">
        <h1 className="landing-title slide-down">Welcome to Luna Ninjas</h1>
        <p className="landing-subtitle">
          Master math through epic ninja quests.
        </p>

        {/* use a button, we control navigation manually */}
        <button className="start-btn" onClick={handleStart}>
          Begin Your Quest
        </button>
      </div>
      <p>remove this </p>
      <div className="ninja-bg"></div>
    </div>
  );
};

export default Home;
