// client/src/components/Leaderboard/Leaderboard.jsx
import React from "react";
import useLeaderboard from "../../hooks/useLeaderboard";
import "./leaderboard.styles.scss";

const Leaderboard = () => {
  const { leaders, loading, error, refetch } = useLeaderboard();

  return (
    <section className="leaderboard">
      <h2 className="leaderboard__title">Top Ninjas</h2>

      {loading && (
        <div className="leaderboard__state leaderboard__state--loading">
          Loading...
        </div>
      )}

      {!loading && error && (
        <div className="leaderboard__state leaderboard__state--error">
          <p>Could not load leaderboard.</p>
          <button className="leaderboard__retry" onClick={refetch}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && leaders.length === 0 && (
        <div className="leaderboard__state leaderboard__state--empty">
          No scores yet. Be the first ninja!
        </div>
      )}

      {!loading && !error && leaders.length > 0 && (
        <table className="leaderboard__table">
          <thead>
            <tr>
              <th className="leaderboard__th leaderboard__th--rank">Rank</th>
              <th className="leaderboard__th leaderboard__th--name">Ninja</th>
              <th className="leaderboard__th leaderboard__th--score">Score</th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((entry) => (
              <tr key={entry.rank} className="leaderboard__row">
                <td className="leaderboard__td leaderboard__td--rank">
                  {entry.rank === 1
                    ? "1st"
                    : entry.rank === 2
                    ? "2nd"
                    : entry.rank === 3
                    ? "3rd"
                    : `${entry.rank}th`}
                </td>
                <td className="leaderboard__td leaderboard__td--name">
                  {entry.name}
                </td>
                <td className="leaderboard__td leaderboard__td--score">
                  {entry.totalScore}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

export default Leaderboard;
