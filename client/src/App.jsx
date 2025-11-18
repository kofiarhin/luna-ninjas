import React from "react";
import "./app.styles.scss";

const App = () => {
  return (
    <div className="landing-wrapper">
      <div className="landing-content">
        <h1 className="landing-title">Welcome to Luna Ninjas</h1>
        <p className="landing-subtitle">
          Master math through epic ninja quests.
        </p>

        <button className="start-btn">Begin Your Quest</button>
      </div>

      <div className="ninja-bg"></div>
    </div>
  );
};

export default App;
