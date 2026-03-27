import React, { useMemo } from "react";
import useInsights from "../../hooks/useInsights";
import "./insights.styles.scss";

const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MULTIPLIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const getCategory = (accuracy) => {
  if (accuracy >= 90) return "mastered";
  if (accuracy >= 70) return "learning";
  if (accuracy >= 1) return "struggling";
  return "unseen";
};

const getCategoryLabel = (cat) => {
  if (cat === "mastered") return "Mastered";
  if (cat === "learning") return "Learning";
  if (cat === "struggling") return "Needs work";
  return "Not tried";
};

const Insights = () => {
  const { facts, loading, error } = useInsights();

  // Build lookup: key "a-b" → { correct, wrong }
  const factMap = useMemo(() => {
    const map = {};
    for (const f of facts) {
      map[`${f.factA}-${f.factB}`] = f;
    }
    return map;
  }, [facts]);

  // Derive per-fact data for the heatmap
  const getCellData = (a, b) => {
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    const f = factMap[key];
    if (!f) return { attempts: 0, accuracy: 0, category: "unseen" };
    const attempts = f.correct + f.wrong;
    const accuracy = attempts > 0 ? Math.round((f.correct / attempts) * 100) : 0;
    return { attempts, accuracy, category: getCategory(accuracy) };
  };

  // Derive table summaries
  const tableSummaries = useMemo(() => {
    return TABLES.map((table) => {
      let totalCorrect = 0;
      let totalWrong = 0;

      MULTIPLIERS.forEach((m) => {
        const key = `${Math.min(table, m)}-${Math.max(table, m)}`;
        const f = factMap[key];
        if (f) {
          totalCorrect += f.correct;
          totalWrong += f.wrong;
        }
      });

      const totalAttempts = totalCorrect + totalWrong;
      const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

      return { table, totalAttempts, totalCorrect, totalWrong, accuracy };
    });
  }, [factMap]);

  if (loading) {
    return (
      <div className="ins">
        <div className="ins__shell">
          <p className="ins__loading">Loading insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ins">
        <div className="ins__shell">
          <p className="ins__error">{error}</p>
        </div>
      </div>
    );
  }

  if (facts.length === 0) {
    return (
      <div className="ins">
        <div className="ins__shell">
          <h1 className="ins__title">Performance Insights</h1>
          <p className="ins__empty">
            No data yet. Play some games to see your performance breakdown here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ins">
      <div className="ins__shell">
        <h1 className="ins__title">Performance Insights</h1>

        {/* Table Summaries */}
        <section className="ins__section">
          <h2 className="ins__heading">Table Summary</h2>
          <div className="ins__cards">
            {tableSummaries.map((s) => {
              const cat = s.totalAttempts > 0 ? getCategory(s.accuracy) : "unseen";
              return (
                <div key={s.table} className={`ins__card ins__card--${cat}`}>
                  <span className="ins__card-table">&times;{s.table}</span>
                  <span className="ins__card-acc">
                    {s.totalAttempts > 0 ? `${s.accuracy}%` : "—"}
                  </span>
                  <span className="ins__card-detail">
                    {s.totalAttempts > 0
                      ? `${s.totalCorrect}/${s.totalAttempts}`
                      : "No attempts"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Heatmap */}
        <section className="ins__section">
          <h2 className="ins__heading">Fact Heatmap</h2>

          <div className="ins__legend">
            <span className="ins__legend-item ins__legend-item--mastered">Mastered</span>
            <span className="ins__legend-item ins__legend-item--learning">Learning</span>
            <span className="ins__legend-item ins__legend-item--struggling">Needs work</span>
            <span className="ins__legend-item ins__legend-item--unseen">Not tried</span>
          </div>

          <div className="ins__heatmap-wrap">
            <table className="ins__heatmap">
              <thead>
                <tr>
                  <th className="ins__heatmap-corner">&times;</th>
                  {MULTIPLIERS.map((m) => (
                    <th key={m} className="ins__heatmap-colhead">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLES.map((table) => (
                  <tr key={table}>
                    <th className="ins__heatmap-rowhead">{table}</th>
                    {MULTIPLIERS.map((m) => {
                      const { accuracy, category, attempts } = getCellData(table, m);
                      return (
                        <td
                          key={m}
                          className={`ins__cell ins__cell--${category}`}
                          title={`${table} × ${m} — ${getCategoryLabel(category)}${
                            attempts > 0 ? ` (${accuracy}%)` : ""
                          }`}
                        >
                          {attempts > 0 ? `${accuracy}%` : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Insights;
