import React, { useEffect } from "react";
import { Trash2 } from "lucide-react";

function HistorySecondaryContent({
  allQuestions,
  files,
  historyChartData,
  quizHistory,
  showHistoryRecords,
  deleteHistoryEntry,
  clearHistory,
  selectedHistoryFile,
  setSelectedHistoryFile,
}) {
  useEffect(() => {
    if (!selectedHistoryFile && files && files.length && setSelectedHistoryFile) {
      setSelectedHistoryFile(files[0]);
    }
  }, [files, selectedHistoryFile, setSelectedHistoryFile]);
  return (
    <div className="file-list" style={{ marginTop: 12 }}>
      {files && files.length ? (
        files.map((file) => (
          <button
            key={file}
            className={`ghost-button ${selectedHistoryFile === file ? 'active' : ''}`}
            onClick={() => setSelectedHistoryFile?.((f) => (f === file ? "" : file))}
            title={`Show history for ${file}`}
          >
            {file}
          </button>
        ))
      ) : (
        <div className="summary-empty-state">No JSON files found</div>
      )}
    </div>
  );
}

export default HistorySecondaryContent;