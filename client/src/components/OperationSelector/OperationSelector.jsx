import React from "react";
import "./operation-selector.styles.scss";

const OperationSelector = ({ onSelect }) => {
  return (
    <div className="op-selector">
      <h2 className="op-selector__heading">Choose your operation</h2>
      <p className="op-selector__sub">Then choose Standard or Smart practice</p>
      <div className="op-selector__grid">
        <button
          className="op-selector__btn"
          onClick={() => onSelect("multiplication")}
        >
          <span className="op-selector__symbol">&times;</span>
          <span className="op-selector__label">Multiplication</span>
        </button>
        <button
          className="op-selector__btn"
          onClick={() => onSelect("division")}
        >
          <span className="op-selector__symbol">&divide;</span>
          <span className="op-selector__label">Division</span>
        </button>
      </div>
    </div>
  );
};

export default OperationSelector;
