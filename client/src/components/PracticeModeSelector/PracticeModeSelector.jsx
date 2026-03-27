import React from "react";
import "./practice-mode-selector.styles.scss";

const PracticeModeSelector = ({ onSelect }) => {
  return (
    <div className="practice-mode-selector">
      <h2 className="practice-mode-selector__heading">Choose your practice mode</h2>
      <p className="practice-mode-selector__sub">
        Standard is random. Smart targets your weak facts.
      </p>

      <div className="practice-mode-selector__grid">
        <button
          className="practice-mode-selector__btn"
          onClick={() => onSelect("standard")}
        >
          <span className="practice-mode-selector__title">Standard Practice</span>
          <span className="practice-mode-selector__desc">
            Random full-table round
          </span>
        </button>

        <button
          className="practice-mode-selector__btn practice-mode-selector__btn--smart"
          onClick={() => onSelect("smart")}
        >
          <span className="practice-mode-selector__title">Smart Practice</span>
          <span className="practice-mode-selector__desc">
            Personalized, weakness-aware round
          </span>
        </button>
      </div>
    </div>
  );
};

export default PracticeModeSelector;
