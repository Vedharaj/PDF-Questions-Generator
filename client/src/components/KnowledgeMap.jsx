import React, { useEffect, useMemo, useState } from 'react'
import TopicTree from './TopicTree'
import GraphView from './GraphView'
import useMapStore from '../store/useMapStore'

export default function KnowledgeMap({ mapping }) {
  const topics = useMemo(() => (Array.isArray(mapping?.topics) ? mapping.topics : []), [mapping])
  const relations = useMemo(() => (Array.isArray(mapping?.relations) ? mapping.relations : []), [mapping])

  const setTopicMap = useMapStore((state) => state.setTopicMap)
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const updateCompact = () => setIsCompact(window.innerWidth < 1180)
    updateCompact()

    window.addEventListener('resize', updateCompact)
    return () => window.removeEventListener('resize', updateCompact)
  }, [])

  const topicMap = useMemo(
    () =>
      topics.reduce((acc, topic) => {
        if (topic?.id) acc[topic.id] = topic
        return acc
      }, {}),
    [topics],
  )

  useEffect(() => {
    setTopicMap(topicMap)
  }, [topicMap, setTopicMap])

  const shellStyle = {
    display: 'grid',
    gridTemplateColumns: isCompact
      ? 'minmax(0, 1fr)'
      : '320px minmax(0, 1fr)',
    gap: 16,
    alignItems: 'stretch',
    height: 'calc(100svh - 40px)',
    minHeight: 620,
  }

  const panelStyle = {
    minHeight: 0,
    borderRadius: 24,
    border: '1px solid rgba(148, 163, 184, 0.16)',
    background:
      'linear-gradient(180deg, rgba(15, 23, 42, 0.72) 0%, rgba(8, 15, 30, 0.82) 100%)',
    backdropFilter: 'blur(18px)',
    boxShadow: '0 20px 50px rgba(2, 6, 23, 0.34)',
    overflow: 'hidden',
  }

  return (
    <div className="knowledge-map" style={shellStyle}>
      {!isCompact ? (
        <aside
          className="km-sidebar"
          style={{
            ...panelStyle,
            padding: 14,
            overflow: 'hidden',
            display: 'grid',
            gap: 12,
            alignContent: 'start',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div className="eyebrow">AI curriculum explorer</div>
              <div style={{ marginTop: 6, color: '#f8fafc', fontSize: 18, fontWeight: 800 }}>{topics.length} topics</div>
            </div>
          </div>
          <TopicTree topics={topics} topicMap={topicMap} />
        </aside>
      ) : null}

      <main
        className="km-main"
        style={{
          ...panelStyle,
          padding: 12,
          minWidth: 0,
          position: 'relative',
        }}
      >
        <div
          className="km-graph-wrap"
          style={{
            height: '100%',
            minHeight: 0,
            borderRadius: 18,
            overflow: 'hidden',
          }}
        >
          <GraphView topics={topics} relations={relations} topicMap={topicMap} />
        </div>
      </main>
    </div>
  )
}
