import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [activeOp, setActiveOp] = useState("multiplication");
  const navigate = useNavigate();

  const isDivision = activeOp === "division";
  const opSymbol = isDivision ? "\u00F7" : "\u00D7";

  // Filter facts by selected operation
  const filteredFacts = useMemo(() => {
    return facts.filter(
      (f) => (f.operation || "multiplication") === activeOp
    );
  }, [facts, activeOp]);

  // Build lookup: key "a-b" → { correct, wrong }
  const factMap = useMemo(() => {
    const map = {};
    for (const f of filteredFacts) {
      map[`${f.factA}-${f.factB}`] = f;
    }
    return map;
  }, [filteredFacts]);

  // Derive per-fact data for the heatmap
  // Multiplication: cell(table, multiplier) → lookup (min, max) commutative
  // Division: cell(table, quotient) → lookup (table, quotient) direct
  const getCellData = (table, m) => {
    const key = isDivision
      ? `${table}-${m}`
      : `${Math.min(table, m)}-${Math.max(table, m)}`;
    const f = factMap[key];
    if (!f) return { attempts: 0, accuracy: 0, category: "unseen" };
    const attempts = f.correct + f.wrong;
    const accuracy =
      attempts > 0 ? Math.round((f.correct / attempts) * 100) : 0;
    return { attempts, accuracy, category: getCategory(accuracy) };
  };

  // Derive table summaries
  const tableSummaries = useMemo(() => {
    return TABLES.map((table) => {
      let totalCorrect = 0;
      let totalWrong = 0;

      MULTIPLIERS.forEach((m) => {
        const key = isDivision
          ? `${table}-${m}`
          : `${Math.min(table, m)}-${Math.max(table, m)}`;
        const f = factMap[key];
        if (f) {
          totalCorrect += f.correct;
          totalWrong += f.wrong;
        }
      });

      const totalAttempts = totalCorrect + totalWrong;
      const accuracy =
        totalAttempts > 0
          ? Math.round((totalCorrect / totalAttempts) * 100)
          : 0;

      return { table, totalAttempts, totalCorrect, totalWrong, accuracy };
    });
  }, [factMap, isDivision]);

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

  return (
    <div className="ins">
      <div className="ins__shell">
        <h1 className="ins__title">Performance Insights</h1>

        {/* Operation toggle */}
        <div className="ins__toggle">
          <button
            className={`ins__toggle-btn${
              activeOp === "multiplication" ? " ins__toggle-btn--active" : ""
            }`}
            onClick={() => setActiveOp("multiplication")}
          >
            Multiplication
          </button>
          <button
            className={`ins__toggle-btn${
              activeOp === "division" ? " ins__toggle-btn--active" : ""
            }`}
            onClick={() => setActiveOp("division")}
          >
            Division
          </button>
        </div>

        {filteredFacts.length === 0 ? (
          <p className="ins__empty">
            No {activeOp} data yet. Play some {activeOp} games to see your
            performance breakdown here.
          </p>
        ) : (
          <>
            {/* Table Summaries */}
            <section className="ins__section">
              <h2 className="ins__heading">Table Summary</h2>
              <div className="ins__cards">
                {tableSummaries.map((s) => {
                  const cat =
                    s.totalAttempts > 0
                      ? getCategory(s.accuracy)
                      : "unseen";
                  return (
                    <button
                      type="button"
                      key={s.table}
                      className={`ins__card ins__card--${cat}`}
                      onClick={() =>
                        navigate("/game", {
                          state: { operation: activeOp, table: s.table },
                        })
                      }
                    >
                      <span className="ins__card-table">
                        {opSymbol}{s.table}
                      </span>
                      <span className="ins__card-acc">
                        {s.totalAttempts > 0 ? `${s.accuracy}%` : "\u2014"}
                      </span>
                      <span className="ins__card-detail">
                        {s.totalAttempts > 0
                          ? `${s.totalCorrect}/${s.totalAttempts}`
                          : "No attempts"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Heatmap */}
            <section className="ins__section">
              <h2 className="ins__heading">Fact Heatmap</h2>

              <div className="ins__legend">
                <span className="ins__legend-item ins__legend-item--mastered">
                  Mastered
                </span>
                <span className="ins__legend-item ins__legend-item--learning">
                  Learning
                </span>
                <span className="ins__legend-item ins__legend-item--struggling">
                  Needs work
                </span>
                <span className="ins__legend-item ins__legend-item--unseen">
                  Not tried
                </span>
              </div>

              <div className="ins__heatmap-wrap">
                <table className="ins__heatmap">
                  <thead>
                    <tr>
                      <th className="ins__heatmap-corner">{opSymbol}</th>
                      {isDivision
                        ? TABLES.map((t) => (
                            <th key={t} className="ins__heatmap-colhead">
                              {t}
                            </th>
                          ))
                        : MULTIPLIERS.map((m) => (
                            <th key={m} className="ins__heatmap-colhead">
                              {m}
                            </th>
                          ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isDivision
                      ? /* Division: rows = quotients (1–12), columns = divisor tables (2–12) */
                        MULTIPLIERS.map((quotient) => (
                          <tr key={quotient}>
                            <th className="ins__heatmap-rowhead">
                              {quotient}
                            </th>
                            {TABLES.map((table) => {
                              const { accuracy, category, attempts } =
                                getCellData(table, quotient);
                              const dividend = table * quotient;
                              return (
                                <td
                                  key={table}
                                  className={`ins__cell ins__cell--${category}`}
                                  title={`${dividend} ÷ ${table} = ${quotient} — ${getCategoryLabel(
                                    category
                                  )}${
                                    attempts > 0 ? ` (${accuracy}%)` : ""
                                  }`}
                                >
                                  {attempts > 0 ? `${accuracy}%` : ""}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      : /* Multiplication: rows = tables (2–12), columns = multipliers (1–12) */
                        TABLES.map((table) => (
                          <tr key={table}>
                            <th className="ins__heatmap-rowhead">{table}</th>
                            {MULTIPLIERS.map((m) => {
                              const { accuracy, category, attempts } =
                                getCellData(table, m);
                              return (
                                <td
                                  key={m}
                                  className={`ins__cell ins__cell--${category}`}
                                  title={`${table} × ${m} — ${getCategoryLabel(
                                    category
                                  )}${
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
          </>
        )}
      </div>
    </div>
  );
};

export default Insights;
