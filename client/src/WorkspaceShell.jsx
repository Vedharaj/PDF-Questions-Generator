function WorkspaceShell({
  primaryItems,
  secondaryHeader,
  secondaryContent,
  secondaryCollapsed,
  onToggleSecondary,
  children,
}) {
  return (
    <div className="workspace-shell" data-secondary-collapsed={secondaryCollapsed}>
      <aside className="workspace-rail" aria-label="Primary navigation">
        <div className="workspace-rail-group">
          {primaryItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`workspace-rail-button ${item.active ? "active" : ""}`}
              onClick={item.onClick}
              aria-label={item.label}
              aria-current={item.active ? "page" : undefined}
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
        </div>

        <div className="workspace-rail-footer">
          <button
            type="button"
            className="workspace-rail-button"
            onClick={onToggleSecondary}
            aria-label={secondaryCollapsed ? "Expand context panel" : "Collapse context panel"}
            title={secondaryCollapsed ? "Expand context panel" : "Collapse context panel"}
          >
            {secondaryCollapsed ? secondaryHeader.expandIcon : secondaryHeader.collapseIcon}
          </button>
        </div>
      </aside>

      <aside className="workspace-context" aria-label={secondaryHeader.label}>
        <div className="workspace-context-surface">
          <div className="workspace-context-header">
            <div>
              <span className="eyebrow">{secondaryHeader.eyebrow}</span>
              <h2>{secondaryHeader.title}</h2>
              {secondaryHeader.description ? <p>{secondaryHeader.description}</p> : null}
            </div>

            <button
              type="button"
              className="workspace-context-toggle"
              onClick={onToggleSecondary}
              aria-label={secondaryCollapsed ? "Open context panel" : "Close context panel"}
              title={secondaryCollapsed ? "Open context panel" : "Close context panel"}
            >
              {secondaryCollapsed ? secondaryHeader.expandIcon : secondaryHeader.collapseIcon}
            </button>
          </div>

          <div className="workspace-context-scroll">{secondaryContent}</div>
        </div>
      </aside>

      <main className="workspace-stage">{children}</main>
    </div>
  );
}

export default WorkspaceShell;