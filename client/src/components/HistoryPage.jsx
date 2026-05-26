import React from "react";
import { Trash2 } from "lucide-react";

export default function HistoryPage({
  summaryStats,
  historyForSelected,
  showHistoryRecords,
  selectedHistoryFile,
  historyChartData,
  deleteHistoryEntry,
  clearHistory,
}) {
  return (
    <div className="workspace-main history-scroll-area">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Session overview</span>
          <h1>Track quiz performance across page ranges and files.</h1>
          <p>
            This view keeps the history context in the sidebar while the main stage highlights session trends and
            recent activity.
          </p>
        </div>

        <div className="hero-stats">
          <div>
            <strong>{summaryStats.averageScore}%</strong>
            <span>Average score</span>
          </div>

          <div>
            <strong>{summaryStats.totalHistoryAttempts}</strong>
            <span>Total attempts</span>
          </div>

          <div>
            <strong>{summaryStats.questionCount}</strong>
            <span>Questions available</span>
          </div>
        </div>
      </section>

      <div>
        <section className="sidebar-section sidebar-history">
          <div className="section-heading">
            <span className="eyebrow">Chart</span>
          </div>

          {historyForSelected.length > 0 ? (
            <>
              {showHistoryRecords && (
                <>
                  <div className="history-chart compact-history-chart">
                    <div className="history-chart-header">
                      <div>
                        <h3>{selectedHistoryFile || historyChartData.fileSummary}</h3>
                      </div>
                    </div>

                    <svg
                      className="history-chart-svg"
                      viewBox={`0 0 ${historyChartData.width} ${historyChartData.height}`}
                      role="img"
                      aria-label="Quiz history chart with page on the x axis and score on the y axis"
                    >
                      <defs>
                        <linearGradient id="historyLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="100%" stopColor="#22c55e" />
                        </linearGradient>
                      </defs>

                      <line
                        x1={historyChartData.padding.left}
                        y1={historyChartData.height - historyChartData.padding.bottom}
                        x2={historyChartData.width - historyChartData.padding.right}
                        y2={historyChartData.height - historyChartData.padding.bottom}
                        className="history-axis"
                      />
                      <line
                        x1={historyChartData.padding.left}
                        y1={historyChartData.padding.top}
                        x2={historyChartData.padding.left}
                        y2={historyChartData.height - historyChartData.padding.bottom}
                        className="history-axis"
                      />

                      {historyChartData.bars.map((bar) => (
                        <g key={bar.key}>
                          <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="12" className="history-bar" />
                          <text x={bar.centerX} y={bar.y - 10} className="history-label score-label" textAnchor="middle">
                            {bar.avgPercentage}%
                          </text>
                          <text x={bar.centerX} y={bar.y - 26} className="history-label count-label" textAnchor="middle">
                            {bar.count} attempt{bar.count > 1 ? "s" : ""}
                          </text>
                          <text x={bar.centerX} y={historyChartData.height - 18} className="history-label x-label" textAnchor="middle">
                            {bar.label}
                          </text>
                        </g>
                      ))}

                      {[0, 1, 2, 3].map((tick) => {
                        const tickValue = Math.round((historyChartData.yMax / 3) * tick);
                        const plotHeight = historyChartData.height - historyChartData.padding.top - historyChartData.padding.bottom;
                        const y = historyChartData.padding.top + plotHeight - ((tickValue / historyChartData.yMax) * plotHeight);

                        return (
                          <g key={tickValue}>
                            <line
                              x1={historyChartData.padding.left}
                              x2={historyChartData.width - historyChartData.padding.right}
                              y1={y}
                              y2={y}
                              className="history-grid"
                            />
                            <text x={historyChartData.padding.left - 12} y={y + 4} className="history-label y-label" textAnchor="end">
                              {tickValue}%
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* <div className="history-list compact-history-list">
                    {historyForSelected.map((entry) => (
                      <div key={entry.id} className="history-item">
                        <div className="history-info">
                          <h4>{entry.file}</h4>
                          <p>{entry.timestamp}</p>
                          <p className="page-range">Pages {entry.pageStart} - {entry.pageEnd}</p>
                        </div>
                        <div className="history-score">
                          <div className="score-badge">
                            <strong>{entry.score}/{entry.totalQuestions}</strong>
                            <span>{entry.percentage}%</span>
                          </div>
                          <button
                            className="ghost-button delete-history-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistoryEntry(entry.id);
                            }}
                            title="Delete record"
                            aria-label={`Delete history ${entry.id}`}
                            style={{ position: "absolute", top: 8, right: 8 }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div> */}

                  <button className="ghost-button sidebar-full-button" onClick={clearHistory}>
                    Clear History
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="summary-empty-state">No quiz attempts yet.</div>
          )}
        </section>
      </div>

    </div>
  );
}
