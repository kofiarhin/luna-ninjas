import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import OperationSelector from "../../components/OperationSelector/OperationSelector";
import PracticeModeSelector from "../../components/PracticeModeSelector/PracticeModeSelector";
import TableSelector from "../../components/TableSelector/TableSelector";
import MultiplicationGame from "../../components/MultiplicationGame/MultiplicationGame";

const VALID_OPERATIONS = ["multiplication", "division"];
const VALID_TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const Game = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [selectedOperation, setSelectedOperation] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [practiceTarget, setPracticeTarget] = useState(null);
  const [gameKey, setGameKey] = useState(0);

  useEffect(() => {
    const state = location.state;
    if (
      state &&
      VALID_OPERATIONS.includes(state.operation) &&
      VALID_TABLES.includes(state.table)
    ) {
      setSelectedOperation(state.operation);
      setSelectedMode("smart");
      setSelectedTable(state.table);
      setPracticeTarget({ operation: state.operation, table: state.table });
      // Clear location state so refresh / back-nav doesn't re-trigger
      navigate(location.pathname, { replace: true, state: null });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    setGameKey((k) => k + 1);
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
          key={gameKey}
          table={selectedTable}
          operation={selectedOperation}
          mode={selectedMode}
          isQuickLaunch={practiceTarget !== null}
          onModeChange={handleModeSelect}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </main>
  );
};

export default Game;
