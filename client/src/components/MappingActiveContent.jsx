import React from "react";
import KnowledgeMap from "./KnowledgeMap";

export default function MappingActiveContent({
  mappingContent,
  mappingContentLoading,
  mappingError,
  selectedMappingFile,
  onRetry,
}) {
  if (mappingContentLoading) {
    return (
      <div className="loading-card">
        <div className="spinner" />
        <h2>Loading mapping</h2>
        <p>Fetching mapping JSON and preparing viewer.</p>
      </div>
    );
  }

  if (mappingError) {
    return (
      <div className="loading-card error-card">
        <h2>Unable to load mapping</h2>
        <p>{mappingError}</p>
        <button className="primary-button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="workspace-main">
      {mappingContent ? (
        <KnowledgeMap mapping={mappingContent} />
      ) : (
        <section className="hero-panel">
          <div className="mapping-content">
            <div className="summary-empty-state">Select a mapping file from the secondary panel.</div>
          </div>
        </section>
      )}
    </div>
  );
}
