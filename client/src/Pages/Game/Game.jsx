import React, { useState } from "react";
import OperationSelector from "../../components/OperationSelector/OperationSelector";
import PracticeModeSelector from "../../components/PracticeModeSelector/PracticeModeSelector";
import TableSelector from "../../components/TableSelector/TableSelector";
import MultiplicationGame from "../../components/MultiplicationGame/MultiplicationGame";

const Game = () => {
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);

  const handleOperationSelect = (operation) => {
    setSelectedOperation(operation);
  };

  const handleTableSelect = (table) => {
    setSelectedTable(table);
  };

  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
  };

  const handlePlayAgain = () => {
    setSelectedOperation(null);
    setSelectedMode(null);
    setSelectedTable(null);
  };

  return (
    <main className="game-page-wrapper">
      {selectedOperation === null ? (
        <OperationSelector onSelect={handleOperationSelect} />
      ) : selectedMode === null ? (
        <PracticeModeSelector onSelect={handleModeSelect} />
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
          mode={selectedMode}
          onModeChange={handleModeSelect}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </main>
  );
};

export default Game;
