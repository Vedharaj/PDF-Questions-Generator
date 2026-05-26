import React from "react";

export default function MappingSecondaryContent({
  mappingFilesLoading,
  mappingFiles,
  selectedMappingFile,
  setSelectedMappingFile,
}) {
  return (
    <div className="secondary-list">

      {mappingFilesLoading ? (
        <div className="loading-small">Loading mapping files…</div>
      ) : (
        <ul className="file-list">
          {mappingFiles && mappingFiles.length ? (
            mappingFiles.map((f) => (
              <li key={f}>
                <button
                  className={`ghost-button ${f === selectedMappingFile ? "active" : ""}`}
                  onClick={() => setSelectedMappingFile(f)}
                >
                  {f}
                </button>
              </li>
            ))
          ) : (
            <li className="empty">No mapping files available</li>
          )}
        </ul>
      )}
    </div>
  );
}
