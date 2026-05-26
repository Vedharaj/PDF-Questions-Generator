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
        <section>

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
          </div>
        </section>
      </>
    );
  }

  return (
    <section>
      <h3>Source and range</h3>
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

        <button className="primary-button" onClick={startQuiz} disabled={!allQuestions.length || pageStart > pageEnd}>
          Start Quiz
        </button>
      </div>
    </section>
  );
}

export default QuizSecondaryContent;