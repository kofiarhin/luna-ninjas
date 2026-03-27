import React, { useState } from "react";
import OperationSelector from "../../components/OperationSelector/OperationSelector";
import TableSelector from "../../components/TableSelector/TableSelector";
import MultiplicationGame from "../../components/MultiplicationGame/MultiplicationGame";

const Game = () => {
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);

  const handleOperationSelect = (operation) => {
    setSelectedOperation(operation);
  };

  const handleTableSelect = (table) => {
    setSelectedTable(table);
  };

  const handlePlayAgain = () => {
    setSelectedOperation(null);
    setSelectedTable(null);
  };

  return (
    <main className="game-page-wrapper">
      {selectedOperation === null ? (
        <OperationSelector onSelect={handleOperationSelect} />
      ) : selectedTable === null ? (
        <TableSelector
          onSelect={handleTableSelect}
          selectedTable={selectedTable}
          operation={selectedOperation}
        />
      ) : (
        <MultiplicationGame
          table={selectedTable}
          operation={selectedOperation}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </main>
  );
};

export default Game;
