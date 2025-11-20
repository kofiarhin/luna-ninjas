// WatermelonAnimation.jsx
import React from "react";

const WatermelonAnimation = ({ visible, slice, miss, onAnimationEnd }) => {
  if (!visible) return null;

  return (
    <div className="watermelon-layer">
      <div
        className={`watermelon ${slice ? "watermelon-slice" : ""} ${
          miss ? "watermelon-miss" : ""
        }`}
        onAnimationEnd={onAnimationEnd}
      >
        <div className="watermelon-halo"></div>
        <div className="watermelon-half watermelon-left"></div>
        <div className="watermelon-half watermelon-right"></div>

        {slice && <div className="watermelon-slash-line"></div>}
      </div>
    </div>
  );
};

export default WatermelonAnimation;
