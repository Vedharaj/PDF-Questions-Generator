function SummarySecondaryContent({ summaryFilesLoading, summaryFiles, selectedSummaryFile, setSelectedSummaryFile }) {
  return (
    <section className="summary-file-list">
      <div className="summary-panel-header compact-header" />

      {summaryFilesLoading ? (
        <div className="summary-empty-state">Loading summaries…</div>
      ) : summaryFiles.length ? (
        <div className="summary-file-list-items">
          {summaryFiles.map((file) => (
            <button
              key={file}
              type="button"
              className={`summary-file-item ${selectedSummaryFile === file ? "active" : ""}`}
              onClick={() => setSelectedSummaryFile(file)}
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
  );
}

export default SummarySecondaryContent;