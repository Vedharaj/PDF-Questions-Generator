import { Minus, Plus } from "lucide-react";
import { useState } from "react";

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
  const [markdownFontSize, setMarkdownFontSize] = useState(20);

  const decreaseFontSize = () => {
    setMarkdownFontSize((currentValue) => Math.max(13, currentValue - 1));
  };

  const increaseFontSize = () => {
    setMarkdownFontSize((currentValue) => Math.min(22, currentValue + 1));
  };

  const previewWorkspace = (
    <section className="summary-preview-panel">
      <div className="summary-preview-scroll">
        {summaryContentLoading ? (
          <div className="summary-empty-state">Loading preview…</div>
        ) : summaryContent ? (
          <div className="summary-markdown-preview" style={{ fontSize: `${markdownFontSize}px` }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeSlug]}
            >{summaryContent}</ReactMarkdown>
          </div>
        ) : (
          <div className="empty-summary-state">Choose a file to preview its content.</div>
        )}
      </div>

      <div className="markdown-font-controls" aria-label="Markdown preview font size controls">
        <button
          type="button"
          className="markdown-font-button"
          onClick={decreaseFontSize}
          disabled={markdownFontSize <= 13}
          aria-label="Decrease preview font size"
          title="Decrease preview font size"
        >
          <Minus size={16} />
        </button>

        <div className="markdown-font-value" aria-live="polite">
          {markdownFontSize}px
        </div>

        <button
          type="button"
          className="markdown-font-button"
          onClick={increaseFontSize}
          disabled={markdownFontSize >= 22}
          aria-label="Increase preview font size"
          title="Increase preview font size"
        >
          <Plus size={16} />
        </button>
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
        </aside>
      </div>
    </div>
  );
}

export default SummarizePage;
