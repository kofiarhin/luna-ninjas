// client/src/components/TableSelector/TableSelector.jsx
import React from "react";
import { WEIGHT_MAP } from "../../utils/scoring";
import "./table-selector.styles.scss";

/**
 * Renders a grid of 11 buttons for tables 2–12.
 * Each button shows the table number and points per correct answer.
 *
 * Props:
 *   onSelect(table: number) — called when a table button is clicked
 *   selectedTable: number | null — the currently selected table (null = none)
 */
const TableSelector = ({ onSelect, selectedTable }) => {
  const tables = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return (
    <div className="table-selector">
      <h2 className="table-selector__heading">Choose your times table</h2>
      <div className="table-selector__grid">
        {tables.map((table) => (
          <button
            key={table}
            className={`table-selector__btn${
              selectedTable === table ? " table-selector__btn--active" : ""
            }`}
            onClick={() => onSelect(table)}
          >
            <span className="table-selector__times">&times;{table}</span>
            <span className="table-selector__pts">
              {WEIGHT_MAP[table]} pts
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TableSelector;
