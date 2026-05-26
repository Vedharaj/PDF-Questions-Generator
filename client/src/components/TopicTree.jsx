import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import useMapStore from '../store/useMapStore'

const LAZY_DEPTH = 3
const LAZY_CHILD_THRESHOLD = 20

const compareTopicsByPageRange = (a, b) => {
  const aStart = Number(a?.page_start)
  const bStart = Number(b?.page_start)
  const aEnd = Number(a?.page_end)
  const bEnd = Number(b?.page_end)

  const aHasStart = !Number.isNaN(aStart)
  const bHasStart = !Number.isNaN(bStart)
  if (aHasStart && bHasStart && aStart !== bStart) return aStart - bStart
  if (aHasStart !== bHasStart) return aHasStart ? -1 : 1

  const aHasEnd = !Number.isNaN(aEnd)
  const bHasEnd = !Number.isNaN(bEnd)
  if (aHasEnd && bHasEnd && aEnd !== bEnd) return aEnd - bEnd
  if (aHasEnd !== bHasEnd) return aHasEnd ? -1 : 1

  return (a.title || a.id || '').localeCompare(b.title || b.id || '')
}

const TreeBranch = memo(function TreeBranch({
  nodeId,
  level,
  topicMap,
  getChildren,
  expandedNodes,
  selectedNode,
  expandCollapse,
  onSelect,
  loadedBranches,
  setLoadedBranches,
  allowedIds,
  activePathIds,
}) {
  const topic = topicMap[nodeId]
  if (!topic) return null

  const children = getChildren(topic).filter((child) => !allowedIds || allowedIds.has(child.id))
  const hasChildren = children.length > 0
  const isExpanded = !!expandedNodes[nodeId]
  const isSelected = selectedNode === nodeId
  const isActivePath = activePathIds?.has(nodeId)
  const isLoaded = !!loadedBranches[nodeId]
  const shouldLazy = level >= LAZY_DEPTH && hasChildren && children.length > LAZY_CHILD_THRESHOLD && !isLoaded
  const branchId = `topic-tree-node-${nodeId}`

  useEffect(() => {
    if (isSelected) {
      const element = document.getElementById(branchId)
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
  }, [branchId, isSelected])

  const keywords = Array.isArray(topic.keywords) ? topic.keywords.filter(Boolean).slice(0, 3) : []
  const pageCount = Array.isArray(topic.pages) ? topic.pages.length : 0

  return (
    <div
      className="tree-node"
      id={branchId}
      style={{
        position: 'relative',
        paddingLeft: 8 + level * 14,
        paddingTop: 3,
        paddingBottom: 3,
      }}
    >
      {level > 0 ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 16 + level * 14,
            top: 0,
            bottom: 0,
            width: 1,
            background: isActivePath ? 'rgba(56, 189, 248, 0.34)' : 'rgba(148, 163, 184, 0.16)',
          }}
        />
      ) : null}

      <div className="tree-row" style={{ display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', gap: 10, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10 }}>
          {hasChildren ? (
            <button
              className="tree-toggle"
              onClick={() => expandCollapse(nodeId)}
              aria-label="toggle"
              style={{
                boxShadow: isActivePath ? '0 0 0 1px rgba(56, 189, 248, 0.22), 0 0 14px rgba(56, 189, 248, 0.12)' : undefined,
              }}
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          ) : (
            <span
              className="tree-toggle-placeholder"
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: isSelected ? 'rgba(56, 189, 248, 0.88)' : 'rgba(148, 163, 184, 0.36)',
                boxShadow: isSelected ? '0 0 12px rgba(56, 189, 248, 0.45)' : 'none',
                marginTop: 3,
              }}
            />
          )}
          <div
            aria-hidden="true"
            style={{
              flex: 1,
              width: 1,
              marginTop: 6,
              background: isActivePath ? 'rgba(96, 165, 250, 0.34)' : 'rgba(148, 163, 184, 0.12)',
            }}
          />
        </div>

        <button
          className={`tree-title ${isSelected ? 'selected' : ''}`}
          style={{
            borderColor: isSelected ? 'rgba(56, 189, 248, 0.56)' : isActivePath ? 'rgba(56, 189, 248, 0.22)' : undefined,
            background: isSelected
              ? 'linear-gradient(180deg, rgba(15, 118, 255, 0.26), rgba(15, 23, 42, 0.82))'
              : isActivePath
                ? 'linear-gradient(180deg, rgba(8, 47, 73, 0.42), rgba(15, 23, 42, 0.74))'
                : undefined,
          }}
          onClick={() => onSelect(nodeId)}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div className="tree-title-text">{topic.title || topic.id}</div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: isActivePath ? '#d9f5ff' : 'rgba(226, 232, 240, 0.7)',
                textTransform: 'uppercase',
                letterSpacing: 0.08,
                marginTop: 2,
              }}
            >
              {topic?.page_start ?? '-'}
            </span>
          </div>
          <div className="tree-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{pageCount}p</span>
            <span>{children.length}c</span>
            {keywords.length ? <span>· {keywords.join(', ')}</span> : null}
          </div>
        </button>
      </div>

      {isExpanded && hasChildren ? (
        <div className="tree-children">
          {shouldLazy ? (
            <div className="lazy-placeholder">
              <div>{children.length} child topics</div>
              <button
                className="ghost-button"
                onClick={() => setLoadedBranches((state) => ({ ...state, [nodeId]: true }))}
              >
                Load subtree
              </button>
            </div>
          ) : (
            children.map((child) => (
              <TreeBranch
                key={child.id}
                nodeId={child.id}
                level={level + 1}
                topicMap={topicMap}
                getChildren={getChildren}
                expandedNodes={expandedNodes}
                selectedNode={selectedNode}
                expandCollapse={expandCollapse}
                onSelect={onSelect}
                loadedBranches={loadedBranches}
                setLoadedBranches={setLoadedBranches}
                allowedIds={allowedIds}
                activePathIds={activePathIds}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  )
})

export default function TopicTree({ topics = [], topicMap = {} }) {
  const searchQuery = useMapStore((state) => state.searchQuery)
  const expandedNodes = useMapStore((state) => state.expandedNodes)
  const selectedNode = useMapStore((state) => state.selectedNode)
  const focusedNode = useMapStore((state) => state.focusedNode)
  const setSearchQuery = useMapStore((state) => state.setSearchQuery)
  const setSelectedNode = useMapStore((state) => state.setSelectedNode)
  const setFocusedNode = useMapStore((state) => state.setFocusedNode)
  const setExpandedNodes = useMapStore((state) => state.setExpandedNodes)
  const toggleExpanded = useMapStore((state) => state.toggleExpanded)
  const setVisibleNodeIds = useMapStore((state) => state.setVisibleNodeIds)
  const focusNext = useMapStore((state) => state.focusNext)
  const focusPrev = useMapStore((state) => state.focusPrev)

  const [loadedBranches, setLoadedBranches] = useState({})

  const childIndex = useMemo(() => {
    const index = new Map()

    topics.forEach((topic) => {
      if (!topic?.id) return

      if (topic.parent_id && topicMap[topic.parent_id]) {
        const bucket = index.get(topic.parent_id) || new Set()
        bucket.add(topic.id)
        index.set(topic.parent_id, bucket)
      }

      if (Array.isArray(topic.children)) {
        const bucket = index.get(topic.id) || new Set()
        topic.children.forEach((childId) => {
          if (topicMap[childId]) bucket.add(childId)
        })
        index.set(topic.id, bucket)
      }
    })

    return index
  }, [topics, topicMap])

  const parentIndex = useMemo(() => {
    const index = new Map()
    childIndex.forEach((children, parentId) => {
      children.forEach((childId) => {
        const bucket = index.get(childId) || new Set()
        bucket.add(parentId)
        index.set(childId, bucket)
      })
    })
    return index
  }, [childIndex])

  const selectedAncestorPath = useMemo(() => {
    if (!selectedNode) return []

    const chain = []
    const visited = new Set()
    let cursor = selectedNode

    while (cursor && !visited.has(cursor)) {
      visited.add(cursor)
      chain.unshift(cursor)
      const parents = parentIndex.get(cursor)
      if (!parents || !parents.size) break
      cursor = Array.from(parents)[0]
    }

    return chain
  }, [parentIndex, selectedNode])

  const activePathIds = useMemo(() => new Set(selectedAncestorPath), [selectedAncestorPath])

  const getChildren = useCallback(
    (topic) => {
      if (!topic?.id) return []
      const childIds = childIndex.get(topic.id)
      if (!childIds) return []
      return Array.from(childIds)
        .map((id) => topicMap[id])
        .filter(Boolean)
        .sort(compareTopicsByPageRange)
    },
    [childIndex, topicMap],
  )

  const getRootTopics = useCallback(() => {
    const roots = topics.filter((topic) => {
      if (!topic?.id) return false
      if (!topic.parent_id) return true
      return !topicMap[topic.parent_id]
    })

    const safeRoots = roots.length ? roots : topics.slice(0, 30)
    return safeRoots.sort(compareTopicsByPageRange)
  }, [topics, topicMap])

  const searchTopics = useCallback(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return null

    const matched = new Set(
      topics
        .filter((topic) => {
          const title = (topic.title || '').toLowerCase()
          const description = (topic.description || '').toLowerCase()
          const keywords = Array.isArray(topic.keywords) ? topic.keywords.join(' ').toLowerCase() : ''
          return title.includes(query) || description.includes(query) || keywords.includes(query)
        })
        .map((topic) => topic.id),
    )

    if (!matched.size) return new Set()

    const include = new Set(matched)
    const stack = [...matched]
    while (stack.length) {
      const childId = stack.pop()
      const parents = parentIndex.get(childId)
      if (!parents) continue
      parents.forEach((parentId) => {
        if (!include.has(parentId)) {
          include.add(parentId)
          stack.push(parentId)
        }
      })
    }

    return include
  }, [searchQuery, topics, parentIndex])

  const expandCollapse = useCallback(
    (id) => {
      toggleExpanded(id)
    },
    [toggleExpanded],
  )

  const filteredIds = useMemo(() => searchTopics(), [searchTopics])

  const visibleNodeIds = useMemo(() => {
    const ordered = []
    const allowed = filteredIds instanceof Set ? filteredIds : null

    const walk = (topic) => {
      if (!topic?.id) return
      if (allowed && !allowed.has(topic.id)) return

      ordered.push(topic.id)
      const children = getChildren(topic)
      if (expandedNodes[topic.id]) {
        children.forEach((child) => walk(child))
      }
    }

    getRootTopics().forEach((root) => walk(root))
    return ordered
  }, [expandedNodes, filteredIds, getChildren, getRootTopics])

  useEffect(() => {
    setVisibleNodeIds(visibleNodeIds)
  }, [visibleNodeIds, setVisibleNodeIds])

  useEffect(() => {
    if (searchQuery.trim()) {
      const querySet = searchTopics()
      if (querySet && querySet.size) {
        const expansion = {}
        querySet.forEach((id) => {
          if (childIndex.has(id)) expansion[id] = true
        })
        setExpandedNodes((state) => ({ ...state, ...expansion }))
      }
    }
  }, [searchQuery, childIndex, searchTopics, setExpandedNodes])

  useEffect(() => {
    if (!selectedAncestorPath.length) return

    const expansion = {}
    selectedAncestorPath.forEach((id) => {
      if (childIndex.has(id)) {
        expansion[id] = true
      }
    })

    if (Object.keys(expansion).length) {
      setExpandedNodes((state) => ({ ...state, ...expansion }))
    }
  }, [childIndex, selectedAncestorPath, setExpandedNodes])

  const keyboardNavigation = useCallback(
    (event) => {
      if (event.key === 'ArrowDown') {
        focusNext()
        event.preventDefault()
      }

      if (event.key === 'ArrowUp') {
        focusPrev()
        event.preventDefault()
      }

      if (event.key === 'ArrowRight' && focusedNode) {
        setExpandedNodes((state) => ({ ...state, [focusedNode]: true }))
        event.preventDefault()
      }

      if (event.key === 'ArrowLeft' && focusedNode) {
        setExpandedNodes((state) => ({ ...state, [focusedNode]: false }))
        event.preventDefault()
      }

      if (event.key === 'Enter' && focusedNode) {
        setSelectedNode(focusedNode)
        event.preventDefault()
      }
    },
    [focusNext, focusPrev, focusedNode, setExpandedNodes, setSelectedNode],
  )

  useEffect(() => {
    const handler = (event) => keyboardNavigation(event)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [keyboardNavigation])

  const rootTopics = useMemo(() => getRootTopics(), [getRootTopics])

  const onExpandAll = useCallback(() => {
    const expansion = {}
    topics.forEach((topic) => {
      if (topic?.id && childIndex.has(topic.id)) expansion[topic.id] = true
    })
    setExpandedNodes(expansion)
  }, [topics, childIndex, setExpandedNodes])

  const onSelect = useCallback(
    (nodeId) => {
      setSelectedNode(nodeId)
      setFocusedNode(nodeId)
    },
    [setFocusedNode, setSelectedNode],
  )

  const onCollapseAll = useCallback(() => {
    setExpandedNodes({})
  }, [setExpandedNodes])

  return (
    <div className="topic-tree">
      <div className="tree-tools" style={{ display: 'grid', gap: 12 }}>
        <input
          className="tree-search"
          placeholder="Search topics, keywords, or descriptions..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />

        <div className="tree-actions">
          <button className="ghost-button" onClick={onCollapseAll}>
            Collapse all
          </button>
          <button className="ghost-button" onClick={onExpandAll}>
            Expand all
          </button>
        </div>
      </div>

      <div className="tree-list" tabIndex={0}>
        {rootTopics.length ? (
          rootTopics.map((root) => (
            <TreeBranch
              key={root.id}
              nodeId={root.id}
              level={0}
              topicMap={topicMap}
              getChildren={getChildren}
              expandedNodes={expandedNodes}
              selectedNode={selectedNode}
              expandCollapse={expandCollapse}
              onSelect={onSelect}
              loadedBranches={loadedBranches}
              setLoadedBranches={setLoadedBranches}
              allowedIds={filteredIds instanceof Set ? filteredIds : null}
              activePathIds={activePathIds}
            />
          ))
        ) : (
          <div className="empty">No topics available</div>
        )}
      </div>
    </div>
  )
}
