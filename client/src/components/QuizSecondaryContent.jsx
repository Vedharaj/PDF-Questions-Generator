import { FileText, Shuffle, Trash2 } from "lucide-react";

function QuizSecondaryContent({
  quizStarted,
  selectedFile,
  files,
  setSelectedFile,
  setQuizStarted,
  shuffleQuestions,
  currentIndex,
  questions,
  score,
  progress,
  quizHistory,
  historyChartData,
  showHistoryRecords,
  setShowHistoryRecords,
  deleteHistoryEntry,
  clearHistory,
  pageStart,
  pageEnd,
  setPageStart,
  setPageEnd,
  distributeQuestions,
  setDistributeQuestions,
  totalQuestionsWanted,
  setTotalQuestionsWanted,
  allQuestions,
  startQuiz,
}) {
  if (quizStarted) {
    return (
      <>
        <section className="sidebar-section">
          <div className="section-heading">
            <span className="eyebrow">Quiz source</span>
            <h2>Current file</h2>
          </div>

          <div className="stacked-controls">
            <label className="field">
              <span>JSON file</span>
              <div className="field-control dropdown">
                <FileText size={18} />
                <select value={selectedFile} onChange={(e) => setSelectedFile(e.target.value)}>
                  {files.map((file) => (
                    <option key={file} value={file}>
                      {file}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <div className="sidebar-button-row">
              <button className="ghost-button" onClick={() => setQuizStarted(false)}>
                Change Range
              </button>

              <button className="shuffle-btn" onClick={shuffleQuestions}>
                <Shuffle size={18} />
                Shuffle
              </button>
            </div>
          </div>
        </section>

        <section className="sidebar-section">
          <div className="section-heading">
            <span className="eyebrow">Session</span>
            <h2>Progress</h2>
          </div>

          <div className="progress-wrapper sidebar-progress">
            <div className="progress-info">
              <span>
                Question {currentIndex + 1} / {questions.length}
              </span>
              <span>Score: {score}</span>
            </div>

            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </section>

        <section className="sidebar-section sidebar-history">
          <div className="section-heading">
            <span className="eyebrow">History</span>
            <h2>Attempts</h2>
          </div>

          {quizHistory.length > 0 ? (
            <>
              <div className="history-chart compact-history-chart">
                <div className="history-chart-header">
                  <div>
                    <h3>{historyChartData.fileSummary}</h3>
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
                      <rect
                        x={bar.x}
                        y={bar.y}
                        width={bar.width}
                        height={bar.height}
                        rx="12"
                        className="history-bar"
                      />
                      <text x={bar.centerX} y={bar.y - 10} className="history-label score-label" textAnchor="middle">
                        {bar.avgPercentage}%
                      </text>
                      <text x={bar.centerX} y={bar.y - 26} className="history-label count-label" textAnchor="middle">
                        {bar.count} attempt{bar.count > 1 ? "s" : ""}
                      </text>
                      <text
                        x={bar.centerX}
                        y={historyChartData.height - 18}
                        className="history-label x-label"
                        textAnchor="middle"
                      >
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

              <div className="history-list compact-history-list">
                {quizHistory.map((entry) => (
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
              </div>

              <button className="ghost-button sidebar-full-button" onClick={clearHistory}>
                Clear History
              </button>
            </>
          ) : (
            <div className="summary-empty-state">No quiz attempts yet.</div>
          )}
        </section>
      </>
    );
  }

  return (
    <section className="sidebar-section">
      <div className="section-heading">
        <span className="eyebrow">Question setup</span>
        <h2>Source and range</h2>
      </div>

      <div className="stacked-controls">
        <label className="field">
          <span>JSON file</span>
          <div className="field-control dropdown">
            <FileText size={18} />
            <select value={selectedFile} onChange={(e) => setSelectedFile(e.target.value)}>
              {files.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
          </div>
        </label>

        <div className="setup-grid landing-setup-grid">
          <label className="field">
            <span>Start page</span>
            <input
              className="field-control number-input"
              type="number"
              min={1}
              max={pageEnd}
              value={pageStart}
              onChange={(e) => setPageStart(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>

          <label className="field">
            <span>End page</span>
            <input
              className="field-control number-input"
              type="number"
              min={pageStart}
              value={pageEnd}
              onChange={(e) => setPageEnd(Math.max(pageStart, Number(e.target.value) || pageStart))}
            />
          </label>
        </div>

        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={distributeQuestions}
            onChange={(e) => setDistributeQuestions(e.target.checked)}
          />
          <span>Distribute questions evenly</span>
        </label>

        {distributeQuestions && (
          <label className="field">
            <span>Total questions needed</span>
            <input
              className="field-control number-input"
              type="number"
              min={1}
              value={totalQuestionsWanted}
              onChange={(e) => setTotalQuestionsWanted(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        )}

        <div className="sidebar-button-row">
          <button className="primary-button" onClick={startQuiz} disabled={!allQuestions.length || pageStart > pageEnd}>
            Start Quiz
          </button>

          <button className="ghost-button" onClick={() => setShowHistoryRecords((prev) => !prev)}>
            {showHistoryRecords ? "Hide history" : "Show history"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default QuizSecondaryContent;