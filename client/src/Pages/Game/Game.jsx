import MultiplicationGame from "../../components/MultiplicationGame/MultiplicationGame";
import sampleQuestions from "./sampledata";

const Game = () => {
  return (
    <div>
      <h1 className="heading center">
        <MultiplicationGame questions={sampleQuestions} />
      </h1>
    </div>
  );
};

export default Game;
