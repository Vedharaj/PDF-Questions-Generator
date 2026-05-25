import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";

function SummarizePage({
  summaryFiles,
  selectedSummaryFile,
  summaryContent,
  summaryFilesLoading,
  summaryContentLoading,
  summaryError,
  onSelectSummaryFile,
  quizHistory,
  embedded = false,
}) {
  const previewWorkspace = (
    <section className="summary-preview-panel">
      <div className="summary-preview-scroll">
        {summaryContentLoading ? (
          <div className="summary-empty-state">Loading preview…</div>
        ) : summaryContent ? (
          <div className="summary-markdown-preview">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeSlug]}
            >{summaryContent}</ReactMarkdown>
          </div>
        ) : (
          <div className="empty-summary-state">Choose a file to preview its content.</div>
        )}
      </div>
    </section>
  );

  if (embedded) {
    return previewWorkspace;
  }

  return (
    <div className="app-shell summarize-shell">
      <div className="workspace-layout summarize-workspace">
        <aside className="workspace-sidebar summary-sidebar">
          <section className="summary-panel summary-file-list">

            {summaryFilesLoading ? (
              <div className="summary-empty-state">Loading summaries…</div>
            ) : summaryFiles.length ? (
              <div className="summary-file-list-items">
                {summaryFiles.map((file) => (
                  <button
                    key={file}
                    type="button"
                    className={`summary-file-item ${selectedSummaryFile === file ? "active" : ""}`}
                    onClick={() => onSelectSummaryFile(file)}
                    title={file}
                  >
                    <span>{file}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="summary-empty-state">No markdown files found in output/summaries.</div>
            )}
          </section>

          <section className="summary-panel summary-history">
            <div className="summary-panel-header compact-header">
              <div>
                <span className="eyebrow">Activity</span>
                <h3>Recent attempts</h3>
              </div>
            </div>

            {quizHistory && quizHistory.length ? (
              <div className="summary-history-list">
                {quizHistory.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="summary-history-item">
                    <div className="history-meta">
                      <strong className="history-file">{entry.file}</strong>
                      <span className="history-time">{entry.timestamp}</span>
                    </div>
                    <div className="history-score-badge">
                      <strong>{entry.score}/{entry.totalQuestions}</strong>
                      <span>{entry.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="summary-empty-state">No recent attempts.</div>
            )}
          </section>
        </aside>

        <main className="workspace-main summary-main">{previewWorkspace}</main>
      </div>
    </div>
  );
}

export default SummarizePage;
