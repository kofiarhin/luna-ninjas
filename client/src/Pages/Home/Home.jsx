import React from "react";
import "./home.styles.scss";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div className="landing-wrapper">
      <div className="landing-content">
        <h1 className="landing-title">Welcome to Luna Ninjas</h1>
        <p className="landing-subtitle">
          Master math through epic ninja quests.
        </p>

        <Link to="/game" className="start-btn">
          Begin Your Quest
        </Link>
      </div>

      <div className="ninja-bg"></div>
    </div>
  );
};

export default Home;
