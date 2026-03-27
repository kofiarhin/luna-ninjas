import React, { useState } from "react";
import TableSelector from "../../components/TableSelector/TableSelector";
import MultiplicationGame from "../../components/MultiplicationGame/MultiplicationGame";

const Game = () => {
  const [selectedTable, setSelectedTable] = useState(null);

  const handleSelect = (table) => {
    setSelectedTable(table);
  };

  const handlePlayAgain = () => {
    setSelectedTable(null);
  };

  return (
    <main className="game-page-wrapper">
      {selectedTable === null ? (
        <TableSelector onSelect={handleSelect} selectedTable={selectedTable} />
      ) : (
        <MultiplicationGame
          table={selectedTable}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </main>
  );
};

export default Game;
