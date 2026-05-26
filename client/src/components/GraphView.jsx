import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background, Controls, MarkerType, ReactFlow, useEdgesState, useNodesState, Handle, Position } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import useMapStore from '../store/useMapStore'

const NODE_WIDTH = 288
const NODE_HEIGHT = 154
const HIERARCHY_MARGIN_X = 48
const HIERARCHY_MARGIN_Y = 44
const HIERARCHY_ROW_GAP = 124
const HIERARCHY_CHILD_GAP = 28
const HIERARCHY_ROOT_GAP = 84
const FOCUS_PADDING = 0.14
const FOCUS_DURATION = 700

const CLUSTER_COLORS = ['#38bdf8', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4']

const RELATION_STYLE = {
  parent_child: { stroke: '#3b82f6', strokeWidth: 2.0, animated: false, dash: undefined },
  related_to: { stroke: '#22d3ee', strokeWidth: 1.4, animated: true, dash: '8 6' },
  prerequisite: { stroke: '#f59e0b', strokeWidth: 1.6, animated: true, dash: undefined },
  depends_on: { stroke: '#ef4444', strokeWidth: 1.6, animated: true, dash: undefined },
  leads_to: { stroke: '#8b5cf6', strokeWidth: 1.6, animated: true, dash: undefined },
  part_of: { stroke: '#60a5fa', strokeWidth: 1.4, animated: true, dash: '4 4' },
  path: { stroke: '#ffd60a', strokeWidth: 3.2, animated: true, dash: undefined },
}

function normalizeRelationType(type) {
  if (!type) return 'related_to'
  return RELATION_STYLE[type] ? type : 'related_to'
}

function hashToClusterColor(value) {
  if (!value) return CLUSTER_COLORS[0]
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return CLUSTER_COLORS[hash % CLUSTER_COLORS.length]
}

function getNodeMetrics(depth = 0, childCount = 0, title = '') {
  const titleLength = (title || '').length
  const childBoost = Math.min(childCount, 8) * 2

  if (depth === 0) {
    return {
      width: Math.min(440, Math.max(360, 304 + Math.min(titleLength, 24) * 2.55)),
      height: 212 + childBoost,
    }
  }

  if (depth === 1) {
    return {
      width: Math.min(372, Math.max(302, 266 + Math.min(titleLength, 26) * 1.7)),
      height: 184 + childBoost,
    }
  }

  if (depth === 2) {
    return {
      width: Math.min(340, Math.max(250, 236 + Math.min(titleLength, 24) * 1.08)),
      height: 164 + childBoost,
    }
  }

  return {
    width: Math.min(296, Math.max(224, 220 + Math.min(titleLength, 20) * 0.92)),
    height: 140 + Math.min(childCount, 4) * 2,
  }
}

function makePlaceholderTopic(id) {
  return {
    id,
    title: id,
    description: '',
    pages: [],
    keywords: [],
    children: [],
  }
}

function normalizeTopicInput(topicLike, topicMap) {
  if (!topicLike) return null

  if (typeof topicLike === 'string') {
    const resolved = topicMap?.[topicLike]
    return resolved ? normalizeTopicInput(resolved, topicMap) : makePlaceholderTopic(topicLike)
  }

  if (typeof topicLike !== 'object') return null

  const id = topicLike.id || topicLike.topic_id
  if (!id) return null

  return {
    ...topicLike,
    id,
    title: topicLike.title || topicLike.name || id,
    description: topicLike.description || '',
    pages: (() => {
      const raw = Array.isArray(topicLike.pages) ? topicLike.pages.filter((p) => p !== null && p !== undefined) : []
      const seen = new Set()
      const out = []
      for (const p of raw) {
        if (!seen.has(p)) {
          seen.add(p)
          out.push(p)
        }
      }
      return out
    })(),
    keywords: Array.isArray(topicLike.keywords) ? [...topicLike.keywords] : [],
    children: Array.isArray(topicLike.children) ? [...topicLike.children] : [],
  }
}

function mergeTopicRecords(existing, incoming, parentId) {
  const merged = {
    ...(existing || {}),
    ...(incoming || {}),
  }

  merged.id = incoming?.id || existing?.id
  merged.title = incoming?.title || existing?.title || merged.id
  merged.description = incoming?.description ?? existing?.description ?? ''
  merged.pages = Array.isArray(incoming?.pages)
    ? [...incoming.pages]
    : Array.isArray(existing?.pages)
      ? [...existing.pages]
      : []
  // normalize: remove null/undefined, dedupe and sort ascending (numeric when possible)
  // dedupe preserving order
  merged.pages = (() => {
    const raw = Array.isArray(merged.pages) ? merged.pages.filter((p) => p !== null && p !== undefined) : []
    const seen = new Set()
    const out = []
    for (const p of raw) {
      if (!seen.has(p)) {
        seen.add(p)
        out.push(p)
      }
    }
    return out
  })()

  // compute page_start and page_end from ordered pages (first/last numeric values)
  const numericPagesOrdered = merged.pages.map((p) => Number(p)).filter((n) => !Number.isNaN(n))
  if (numericPagesOrdered.length) {
    merged.page_start = numericPagesOrdered[0]
    merged.page_end = numericPagesOrdered[numericPagesOrdered.length - 1]
  } else {
    merged.page_start = incoming?.page_start ?? existing?.page_start ?? null
    merged.page_end = incoming?.page_end ?? existing?.page_end ?? null
  }

  // ensure start <= end when both are present
  if (merged.page_start != null && merged.page_end != null) {
    const ps = Number(merged.page_start)
    const pe = Number(merged.page_end)
    if (!Number.isNaN(ps) && !Number.isNaN(pe) && ps > pe) {
      merged.page_start = pe
      merged.page_end = ps
    }
  }
  merged.keywords = Array.isArray(incoming?.keywords)
    ? [...incoming.keywords]
    : Array.isArray(existing?.keywords)
      ? [...existing.keywords]
      : []
  merged.children = Array.isArray(incoming?.children)
    ? [...incoming.children]
    : Array.isArray(existing?.children)
      ? [...existing.children]
      : []
  merged.parent_id = incoming?.parent_id ?? existing?.parent_id ?? parentId ?? null

  return merged
}

function collectTopicNodes(topicLike, nodesById, topicMap, parentId = null, ancestry = new Set()) {
  const normalized = normalizeTopicInput(topicLike, topicMap)
  if (!normalized?.id || ancestry.has(normalized.id)) return

  const nextAncestry = new Set(ancestry)
  nextAncestry.add(normalized.id)

  const merged = mergeTopicRecords(nodesById.get(normalized.id), normalized, parentId)
  if (parentId && !merged.parent_id) {
    merged.parent_id = parentId
  }
  nodesById.set(merged.id, merged)

  const rawChildren = Array.isArray(normalized.children) ? normalized.children : []
  rawChildren.forEach((childLike) => {
    const childId = typeof childLike === 'string' ? childLike : childLike?.id
    if (!childId) return

    const resolvedChild =
      typeof childLike === 'object'
        ? childLike
        : nodesById.get(childId) || topicMap?.[childId] || makePlaceholderTopic(childId)

    collectTopicNodes(resolvedChild, nodesById, topicMap, merged.id, nextAncestry)
  })
}

function resolveChildren(topic, topicMap) {
  const rawChildren = Array.isArray(topic?.children) ? topic.children : []
  const seen = new Set()

  return rawChildren
    .map((childLike) => {
      const childId = typeof childLike === 'string' ? childLike : childLike?.id
      if (!childId || seen.has(childId)) return null
      seen.add(childId)

      const resolved =
        typeof childLike === 'object'
          ? normalizeTopicInput(childLike, topicMap)
          : normalizeTopicInput(topicMap?.[childId], topicMap) || makePlaceholderTopic(childId)

      return resolved || makePlaceholderTopic(childId)
    })
    .filter(Boolean)
}

function buildHierarchyEdges(nodesById, topicMap) {
  const edges = []
  const seen = new Set()

  const addEdge = (source, target) => {
    if (!source || !target || source === target || !nodesById.has(source) || !nodesById.has(target)) return
    const edgeId = `parent:${source}->${target}`
    if (seen.has(edgeId)) return
    seen.add(edgeId)

    const style = RELATION_STYLE.parent_child
    edges.push({
      id: edgeId,
      source,
      target,
      type: 'step',
      animated: false,
      label: '',
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: style.stroke },
      style: {
        stroke: '#e8fbff',
        strokeWidth: 2.2,
        opacity: 0.94,
        strokeLinecap: 'round',
        filter: undefined,
      },
      interactionWidth: 20,
      zIndex: 1,
      data: { relation: 'parent_child', semantic: false, kind: 'hierarchy' },
    })
  }

  nodesById.forEach((topic) => {
    if (topic?.parent_id) {
      addEdge(topic.parent_id, topic.id)
    }

    resolveChildren(topic, topicMap).forEach((child) => {
      addEdge(topic.id, child.id)
    })
  })

  return edges
}

function buildSemanticEdges(relations, topicMap) {
  return (relations || [])
    .map((relation, index) => {
      const source = relation?.source
      const target = relation?.target
      if (!source || !target || source === target || !topicMap?.[source] || !topicMap?.[target]) {
        return null
      }

      const relationType = normalizeRelationType(relation.type)
      const style = RELATION_STYLE[relationType]

      return {
        id: `semantic:${source}->${target}:${relationType}:${index}`,
        source,
        target,
        type: 'smoothstep',
        animated: false,
        label: relationType,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: style.stroke },
        style: {
          stroke: style.stroke,
          strokeWidth: style.strokeWidth + 0.1,
          strokeDasharray: style.dash,
          opacity: 0.9,
          strokeLinecap: 'round',
          filter: undefined,
        },
        zIndex: 0,
        labelBgStyle: {
          fill: 'rgba(2, 6, 23, 0.88)',
          color: '#f8fafc',
          borderRadius: 10,
        },
        labelStyle: {
          fill: '#f8fafc',
          fontWeight: 700,
          fontSize: 11,
        },
        data: { relation: relationType, semantic: true, kind: 'semantic' },
      }
    })
    .filter(Boolean)
}

function buildPathEdgesFrom(rootId, childrenByParent) {
  if (!rootId || !childrenByParent) return []
  const edges = []
  const seen = new Set()

  const walk = (nodeId) => {
    const children = Array.from(childrenByParent.get(nodeId) || [])
    if (!children.length) return
    children.forEach((childId) => {
      if (!childId) return
      const edgeId = `path:${nodeId}->${childId}`
      if (seen.has(edgeId)) return
      seen.add(edgeId)

      edges.push({
        id: edgeId,
        source: nodeId,
        target: childId,
        type: 'smoothstep',
        animated: true,
        label: '',
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#ffd60a' },
        style: {
          stroke: '#ffd60a',
          strokeWidth: 2.6,
          opacity: 1,
          strokeLinecap: 'round',
          filter: undefined,
        },
        zIndex: 60,
        data: { relation: 'path', semantic: false, kind: 'path' },
      })

      walk(childId)
    })
  }

  walk(rootId)
  return edges
}

function buildChildrenMap(edges) {
  const childrenByParent = new Map()

  edges.forEach((edge) => {
    if (!edge?.source || !edge?.target) return
    const bucket = childrenByParent.get(edge.source) || new Set()
    bucket.add(edge.target)
    childrenByParent.set(edge.source, bucket)
  })

  return childrenByParent
}

function buildParentMap(edges) {
  const parentById = new Map()

  edges.forEach((edge) => {
    if (!edge?.source || !edge?.target) return
    parentById.set(edge.target, edge.source)
  })

  return parentById
}

function buildRootIds(nodesById, hierarchyEdges) {
  const incoming = new Set()
  hierarchyEdges.forEach((edge) => {
    if (edge?.target) incoming.add(edge.target)
  })

  const roots = Array.from(nodesById.values())
    .filter((topic) => topic?.id && (!topic.parent_id || !incoming.has(topic.id)))
    .sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id))

  if (roots.length) return roots.map((topic) => topic.id)

  return Array.from(nodesById.values())
    .filter((topic) => topic?.id && !incoming.has(topic.id))
    .map((topic) => topic.id)
}

function buildDepthMap(rootIds, childrenByParent, nodesById) {
  const depthById = new Map()

  const walk = (nodeId, depth, ancestry = new Set()) => {
    if (!nodeId || ancestry.has(nodeId)) return
    const existingDepth = depthById.get(nodeId)
    if (existingDepth !== undefined && existingDepth <= depth) return

    depthById.set(nodeId, depth)
    const nextAncestry = new Set(ancestry)
    nextAncestry.add(nodeId)

    const children = childrenByParent.get(nodeId)
    if (!children || !children.size) return

    children.forEach((childId) => walk(childId, depth + 1, nextAncestry))
  }

  rootIds.forEach((rootId) => walk(rootId, 0))

  nodesById.forEach((_, nodeId) => {
    if (!depthById.has(nodeId)) {
      depthById.set(nodeId, 0)
    }
  })

  return depthById
}

function buildRootAssignments(rootIds, childrenByParent) {
  const rootById = new Map()

  const walk = (nodeId, rootId, ancestry = new Set()) => {
    if (!nodeId || ancestry.has(nodeId)) return
    if (rootById.has(nodeId)) return

    rootById.set(nodeId, rootId)
    const nextAncestry = new Set(ancestry)
    nextAncestry.add(nodeId)

    const children = childrenByParent.get(nodeId)
    if (!children || !children.size) return

    children.forEach((childId) => walk(childId, rootId, nextAncestry))
  }

  rootIds.forEach((rootId) => walk(rootId, rootId))
  return rootById
}

function layoutDagre(nodes, edges, rootIds, childrenByParent, depthById) {
  const nodeLookup = new Map(nodes.map((node) => [node.id, node]))
  const subtreeWidthById = new Map()
  const depthToNodes = new Map()

  const getNode = (nodeId) => nodeLookup.get(nodeId)

  const getChildren = (nodeId) => {
    return Array.from(childrenByParent?.get(nodeId) || [])
      .filter((childId) => nodeLookup.has(childId))
      .sort((leftId, rightId) => {
        const leftDepth = depthById?.get(leftId) ?? 0
        const rightDepth = depthById?.get(rightId) ?? 0
        if (leftDepth !== rightDepth) return leftDepth - rightDepth
        const leftTitle = getNode(leftId)?.data?.title || leftId
        const rightTitle = getNode(rightId)?.data?.title || rightId
        return leftTitle.localeCompare(rightTitle)
      })
  }

  const measureSubtree = (nodeId, ancestry = new Set()) => {
    if (subtreeWidthById.has(nodeId)) return subtreeWidthById.get(nodeId)
    const node = getNode(nodeId)
    if (!node) return NODE_WIDTH
    if (ancestry.has(nodeId)) return node.width || NODE_WIDTH

    const nextAncestry = new Set(ancestry)
    nextAncestry.add(nodeId)

    const children = getChildren(nodeId)
    const childWidths = children.map((childId) => measureSubtree(childId, nextAncestry))
    const childrenSpan = childWidths.length ? childWidths.reduce((sum, width) => sum + width, 0) + HIERARCHY_CHILD_GAP * Math.max(childWidths.length - 1, 0) : 0
    const span = Math.max(node.width || NODE_WIDTH, childrenSpan)

    subtreeWidthById.set(nodeId, span)
    return span
  }

  const rootOrder = Array.isArray(rootIds) && rootIds.length ? rootIds.filter((rootId) => nodeLookup.has(rootId)) : nodes.filter((node) => (depthById?.get(node.id) ?? 0) === 0).map((node) => node.id)
  const orderedRoots = rootOrder.sort((leftId, rightId) => {
    const leftTitle = getNode(leftId)?.data?.title || leftId
    const rightTitle = getNode(rightId)?.data?.title || rightId
    return leftTitle.localeCompare(rightTitle)
  })

  orderedRoots.forEach((rootId) => {
    measureSubtree(rootId)
  })

  const depthSet = new Set()
  nodes.forEach((node) => {
    const depth = Number(depthById?.get(node.id) ?? node.data?.depth ?? 0)
    depthSet.add(depth)
    const bucket = depthToNodes.get(depth) || []
    bucket.push(node)
    depthToNodes.set(depth, bucket)
  })

  const sortedDepths = Array.from(depthSet).sort((left, right) => left - right)
  const depthTopByDepth = new Map()
  let cursorY = HIERARCHY_MARGIN_Y

  sortedDepths.forEach((depth) => {
    const layerNodes = depthToNodes.get(depth) || []
    const layerHeight = layerNodes.reduce((maxHeight, node) => Math.max(maxHeight, node.height || NODE_HEIGHT), NODE_HEIGHT)
    depthTopByDepth.set(depth, cursorY)
    cursorY += layerHeight + HIERARCHY_ROW_GAP
  })

  const positionedNodes = new Map()

  const placeNode = (nodeId, left, ancestry = new Set()) => {
    const node = getNode(nodeId)
    if (!node || ancestry.has(nodeId)) return

    const nextAncestry = new Set(ancestry)
    nextAncestry.add(nodeId)

    const nodeWidth = node.width || NODE_WIDTH
    const nodeHeight = node.height || NODE_HEIGHT
    const subtreeWidth = subtreeWidthById.get(nodeId) || nodeWidth
    const depth = Number(depthById?.get(nodeId) ?? node.data?.depth ?? 0)
    const y = depthTopByDepth.get(depth) ?? depth * HIERARCHY_ROW_GAP + HIERARCHY_MARGIN_Y
    const x = left + (subtreeWidth - nodeWidth) / 2

    positionedNodes.set(nodeId, { x, y, width: nodeWidth, height: nodeHeight })

    const children = getChildren(nodeId)
    if (!children.length) return

    const childWidths = children.map((childId) => subtreeWidthById.get(childId) || NODE_WIDTH)
    const childrenSpan = childWidths.reduce((sum, width) => sum + width, 0) + HIERARCHY_CHILD_GAP * Math.max(children.length - 1, 0)
    let childCursor = left + (subtreeWidth - childrenSpan) / 2

    children.forEach((childId, index) => {
      placeNode(childId, childCursor, nextAncestry)
      childCursor += childWidths[index] + HIERARCHY_CHILD_GAP
    })
  }

  let rootCursor = HIERARCHY_MARGIN_X
  orderedRoots.forEach((rootId, index) => {
    placeNode(rootId, rootCursor)
    rootCursor += (subtreeWidthById.get(rootId) || NODE_WIDTH) + (index === orderedRoots.length - 1 ? 0 : HIERARCHY_ROOT_GAP)
  })

  if (!orderedRoots.length) {
    nodes.forEach((node) => {
      if (!positionedNodes.has(node.id)) {
        const depth = Number(depthById?.get(node.id) ?? node.data?.depth ?? 0)
        positionedNodes.set(node.id, {
          x: HIERARCHY_MARGIN_X,
          y: depthTopByDepth.get(depth) ?? depth * HIERARCHY_ROW_GAP + HIERARCHY_MARGIN_Y,
          width: node.width || NODE_WIDTH,
          height: node.height || NODE_HEIGHT,
        })
      }
    })
  }

  const bounds = Array.from(positionedNodes.values()).reduce(
    (accumulator, position) => {
      const right = position.x + position.width
      const bottom = position.y + position.height
      return {
        minX: Math.min(accumulator.minX, position.x),
        minY: Math.min(accumulator.minY, position.y),
        maxX: Math.max(accumulator.maxX, right),
        maxY: Math.max(accumulator.maxY, bottom),
      }
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )

  const offsetX = Number.isFinite(bounds.minX) ? HIERARCHY_MARGIN_X - bounds.minX : 0
  const offsetY = Number.isFinite(bounds.minY) ? HIERARCHY_MARGIN_Y - bounds.minY : 0

  return nodes.map((node) => {
    const position = positionedNodes.get(node.id)
    return {
      ...node,
      position: position
        ? {
          x: position.x + offsetX,
          y: position.y + offsetY,
        }
        : { x: HIERARCHY_MARGIN_X, y: HIERARCHY_MARGIN_Y },
    }
  })
}

function buildGraph(topics, relations, topicMap, graphFilters) {
  const nodesById = new Map()
  const normalizedTopics = Array.isArray(topics) ? topics : []
  const normalizedTopicMap = topicMap && typeof topicMap === 'object' ? topicMap : {}

  Object.values(normalizedTopicMap).forEach((topic) => {
    collectTopicNodes(topic, nodesById, normalizedTopicMap)
  })

  normalizedTopics.forEach((topic) => {
    collectTopicNodes(topic, nodesById, normalizedTopicMap)
  })

  nodesById.forEach((topic) => {
    if (topic?.parent_id && !nodesById.has(topic.parent_id)) {
      nodesById.set(topic.parent_id, makePlaceholderTopic(topic.parent_id))
    }
  })

  const hierarchyEdges = buildHierarchyEdges(nodesById, normalizedTopicMap)
  const semanticEdges = buildSemanticEdges(relations, normalizedTopicMap)
  const showHierarchy = graphFilters?.showHierarchy !== false
  const showSemantic = graphFilters?.showSemantic !== false
  const layoutEdges = showHierarchy && hierarchyEdges.length ? hierarchyEdges : semanticEdges

  const rootIds = buildRootIds(nodesById, hierarchyEdges.length ? hierarchyEdges : layoutEdges)
  const rootIdSet = new Set(rootIds)
  const childrenByParent = buildChildrenMap(hierarchyEdges.length ? hierarchyEdges : layoutEdges)
  const parentById = buildParentMap(hierarchyEdges)
  const depthById = buildDepthMap(rootIds, childrenByParent, nodesById)
  const rootById = buildRootAssignments(rootIds, childrenByParent)

  const nodes = Array.from(nodesById.values())
    .filter((topic) => topic?.id)
    .map((topic) => {
      const rootId = rootById.get(topic.id) || topic.id
      const childCount = (childrenByParent.get(topic.id) || new Set()).size
      const depth = depthById.get(topic.id) ?? 0
      const metrics = getNodeMetrics(depth, childCount, topic.title || topic.id)

      return {
        id: topic.id,
        type: 'semanticNode',
        
        width: metrics.width,
        height: metrics.height,
        draggable: true,
        position: { x: 0, y: 0 },
        sourcePosition: 'bottom',
        targetPosition: 'top',
        zIndex: depth === 0 ? 30 : depth === 1 ? 22 : depth === 2 ? 18 : 10,
        data: {
          id: topic.id,
          title: topic.title || topic.id,
          description: topic.description || '',
          pages: Array.isArray(topic.pages) ? topic.pages : [],
          keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
          depth,
          isRoot: rootIdSet.has(topic.id),
          childCount,
          clusterId: rootId,
          clusterColor: topic.clusterColor || hashToClusterColor(rootId),
          width: metrics.width,
          height: metrics.height,
        },
      }
    })

  const laidOutNodes = layoutDagre(nodes, layoutEdges, rootIds, childrenByParent, depthById)

  return {
    nodes: laidOutNodes,
    edges: [...(showHierarchy ? hierarchyEdges : []), ...(showSemantic ? semanticEdges : [])],
    parentById,
    childrenByParent,
    depthById,
    rootIds,
  }
}

function SemanticNode({ data, selected, dragging }) {
  const description = data.description || 'No description available.'
  const pages = Array.isArray(data.pages) ? data.pages.slice(0, 4) : []
  const keywords = Array.isArray(data.keywords) ? data.keywords.slice(0, 3) : []
  const depth = Number(data.depth) || 0
  const accent = data.isRoot ? '#b388ff' : data.clusterColor || '#38bdf8'
  const isRoot = !!data.isRoot
  const isAncestor = !!data.isAncestor
  const isDescendant = !!data.isDescendant
  const isSibling = !!data.isSibling
  const isHovered = !!data.isHovered
  const isElevated = selected || isHovered
  const depthLabel = depth === 0 ? 'Root' : depth === 1 ? 'Subsystem' : depth === 2 ? 'Concept' : 'Leaf'
  const titleSize = depth === 0 ? 18 : depth === 1 ? 16 : depth === 2 ? 15 : 14.5
  const nodeGlow = selected
    ? `0 0 0 1px ${accent}, 0 0 36px ${accent}55, 0 22px 48px rgba(0, 6, 24, 0.62)`
    : isHovered
      ? `0 0 0 1px ${accent}, 0 0 28px ${accent}44, 0 18px 42px rgba(0, 6, 24, 0.5)`
      : isRoot
        ? '0 0 0 1px rgba(179, 136, 255, 0.34), 0 16px 36px rgba(46, 18, 88, 0.44)'
        : isAncestor
          ? '0 0 0 1px rgba(96, 165, 250, 0.24), 0 14px 32px rgba(1, 7, 20, 0.44)'
          : '0 12px 28px rgba(1, 7, 20, 0.38)'
  const borderColor = selected
    ? accent
    : isHovered
      ? accent
      : isRoot
        ? 'rgba(179, 136, 255, 0.92)'
        : isAncestor
          ? 'rgba(96, 165, 250, 0.56)'
          : isDescendant
            ? 'rgba(34, 211, 238, 0.34)'
            : 'rgba(148, 163, 184, 0.24)'
  const cardBackground = isRoot
    ? 'linear-gradient(162deg, rgba(44, 17, 82, 0.98) 0%, rgba(20, 10, 43, 0.94) 58%, rgba(8, 11, 25, 0.96) 100%)'
    : depth === 1
      ? 'linear-gradient(162deg, rgba(14, 30, 53, 0.98) 0%, rgba(9, 18, 36, 0.92) 100%)'
      : 'linear-gradient(162deg, rgba(11, 19, 34, 0.98) 0%, rgba(7, 12, 24, 0.92) 100%)'

  return (
    <div
      style={{
        minWidth: data.width || 248,
        maxWidth: data.width || 316,
        borderRadius: 24,
        border: `1px solid ${borderColor}`,
        background: cardBackground,
        boxShadow: dragging ? '0 18px 34px rgba(0, 6, 24, 0.38)' : nodeGlow,
        backdropFilter: 'blur(16px) saturate(120%)',
        color: '#e5edf9',
        padding: 14,
        overflow: 'visible',
        position: 'relative',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, opacity 180ms ease, filter 180ms ease',
        transform: selected ? 'translateY(-4px) scale(1.03)' : isHovered ? 'translateY(-2px) scale(1.015)' : isRoot ? 'translateY(0) scale(1.01)' : 'translateY(0)',
        opacity: isSibling && !selected && !isHovered ? 0.86 : 1,
        filter: isElevated ? 'brightness(1.06)' : 'none',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01) 34%, rgba(255,255,255,0.03) 100%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '-22% -16% auto -16%',
          height: '58%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}30 0%, transparent 72%)`,
          filter: 'blur(20px)',
          pointerEvents: 'none',
          opacity: isElevated ? 1 : 0.7,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ height: 4, flex: 1, borderRadius: 999, background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.1))`, opacity: 0.96 }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.16,
              textTransform: 'uppercase',
              color: isRoot ? '#f3e8ff' : 'rgba(226, 232, 240, 0.76)',
            }}
          >
            {depthLabel}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: titleSize, fontWeight: 850, lineHeight: 1.2, letterSpacing: -0.18 }}>{data.title || data.id}</div>
          {isRoot ? (
            <span
              style={{
                fontSize: 13,
                lineHeight: 1,
                color: '#f0d9ff',
                textShadow: '0 0 14px rgba(192, 132, 252, 0.7)',
              }}
            >
              ✦
            </span>
          ) : null}
        </div>

        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.5,
            opacity: 0.9,
            marginBottom: 12,
            maxHeight: 56,
            overflow: 'hidden',
          }}
        >
          {description}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '4px 8px',
              borderRadius: 999,
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.34)',
              color: '#d9f5ff',
            }}
          >
            {data.childCount || 0} children
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '4px 8px',
              borderRadius: 999,
              background: isRoot ? 'rgba(168, 85, 247, 0.18)' : 'rgba(148, 163, 184, 0.1)',
              border: `1px solid ${isRoot ? 'rgba(168, 85, 247, 0.32)' : 'rgba(148, 163, 184, 0.2)'}`,
              color: isRoot ? '#f3e8ff' : '#e2e8f0',
            }}
          >
            Depth {depth}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '4px 8px',
              borderRadius: 999,
              background: 'rgba(148, 163, 184, 0.12)',
              border: '1px solid rgba(148, 163, 184, 0.22)',
              color: '#e2e8f0',
            }}
          >
            {pages.length ? `${pages.length} pages` : 'No page data'}
          </span>
        </div>

        <div style={{ fontSize: 11, opacity: 0.92, marginBottom: 10 }}>
          {pages.length ? `Pages: ${pages.join(', ')}` : 'Pages: -'}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {keywords.length ? (
            keywords.map((keyword) => (
              <span
                key={`${data.id}-${keyword}`}
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: 'rgba(34, 211, 238, 0.15)',
                  border: '1px solid rgba(34, 211, 238, 0.34)',
                  color: '#d8f7ff',
                }}
              >
                {keyword}
              </span>
            ))
          ) : (
            <span style={{ fontSize: 10, opacity: 0.74 }}>No keywords</span>
          )}
        </div>
        <Handle type="target" position={Position.Top} style={{ width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
        <Handle type="source" position={Position.Bottom} style={{ width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
      </div>
    </div>
  )
}

const SemanticNodeCard = memo(SemanticNode)

export default function GraphView({ topics = [], relations = [], topicMap = {} }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const reactFlowInstanceRef = useRef(null)
  const fitTimerRef = useRef(null)

  const selectedNode = useMapStore((state) => state.selectedNode)
  const focusedNode = useMapStore((state) => state.focusedNode)
  const highlightedRelations = useMapStore((state) => state.highlightedRelations)
  const graphFilters = useMapStore((state) => state.graphFilters)
  const setSelectedNode = useMapStore((state) => state.setSelectedNode)
  const setHighlightedRelations = useMapStore((state) => state.setHighlightedRelations)
  const setZoomState = useMapStore((state) => state.setZoomState)
  const setViewport = useMapStore((state) => state.setViewport)
  const centerOnNode = useMapStore((state) => state.centerOnNode)
  const searchQuery = useMapStore((state) => state.searchQuery)

  const nodeTypes = useMemo(() => ({ semanticNode: SemanticNodeCard }), [])

  const graphSeed = useMemo(() => buildGraph(topics, relations, topicMap, graphFilters), [topics, relations, topicMap, graphFilters])

  const pathEdges = useMemo(() => {
    if (!selectedNode) return []
    return buildPathEdgesFrom(selectedNode, graphSeed.childrenByParent)
  }, [selectedNode, graphSeed.childrenByParent])

  const selectionState = useMemo(() => {
    const activeIds = new Set()
    const ancestorIds = new Set()
    const descendantIds = new Set()
    const siblingIds = new Set()

    if (!selectedNode) {
      return { activeIds, ancestorIds, descendantIds, siblingIds }
    }

    let cursor = selectedNode
    while (cursor && !ancestorIds.has(cursor)) {
      ancestorIds.add(cursor)
      activeIds.add(cursor)
      cursor = graphSeed.parentById.get(cursor)
    }

    const stack = [selectedNode]
    while (stack.length) {
      const nodeId = stack.pop()
      const children = graphSeed.childrenByParent.get(nodeId)
      if (!children || !children.size) continue

      children.forEach((childId) => {
        if (childId === selectedNode || descendantIds.has(childId)) return
        descendantIds.add(childId)
        activeIds.add(childId)
        stack.push(childId)
      })
    }

    const parentId = graphSeed.parentById.get(selectedNode)
    if (parentId) {
      const siblings = graphSeed.childrenByParent.get(parentId) || new Set()
      siblings.forEach((siblingId) => {
        if (siblingId !== selectedNode) {
          siblingIds.add(siblingId)
          activeIds.add(siblingId)
        }
      })
    }

    activeIds.add(selectedNode)
    return { activeIds, ancestorIds, descendantIds, siblingIds }
  }, [graphSeed.childrenByParent, graphSeed.parentById, selectedNode])

  /* Hover-based focus removed: interaction comes from selection only */

  const interactionState = useMemo(() => selectionState, [selectionState])

  useEffect(() => {
    setNodes(graphSeed.nodes)
    setEdges([...(graphSeed.edges || []), ...(pathEdges || [])])
  }, [graphSeed, setNodes, setEdges, pathEdges])

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: node.id === selectedNode,
        zIndex:
          node.id === selectedNode
            ? 48
            : node.data?.isRoot
              ? 30
              : interactionState.activeIds.has(node.id)
                ? 18
                : node.zIndex || 1,
        style: {
          ...(node.style || {}),
          opacity: selectedNode && !interactionState.activeIds.has(node.id) ? 0.6 : 1,
        },
        data: {
          ...node.data,
          isSelected: node.id === selectedNode,
          isAncestor: interactionState.ancestorIds.has(node.id) && node.id !== selectedNode,
          isDescendant: interactionState.descendantIds.has(node.id) && node.id !== selectedNode,
          isSibling: interactionState.siblingIds.has(node.id) && node.id !== selectedNode,
          focused: node.id === focusedNode,
        },
      })),
    )
  }, [focusedNode, interactionState, selectedNode, setNodes])

  useEffect(() => {
    const highlighted = new Set(Array.isArray(highlightedRelations) ? highlightedRelations : [])
    const focusIds = selectionState.activeIds

    setEdges((current) =>
      current.map((edge) => {
        const base = RELATION_STYLE[edge.data?.relation] || RELATION_STYLE.related_to
        const isHighlighted = !highlighted.size || highlighted.has(edge.id)
        const isHierarchy = !edge.data?.semantic
        const touchesFocus = selectedNode && (focusIds.has(edge.source) || focusIds.has(edge.target))
        const hierarchyStrong = isHierarchy && (focusIds.has(edge.source) || focusIds.has(edge.target))
        return {
          ...edge,
          animated: false,
          style: {
            ...edge.style,
            stroke: base.stroke,
            strokeWidth: isHierarchy ? (hierarchyStrong ? (base.strokeWidth + 1.5) : (base.strokeWidth + 0.7)) : isHighlighted ? base.strokeWidth + 1 : base.strokeWidth,
            opacity: selectedNode ? (touchesFocus || isHighlighted ? 1 : 0.16) : isHighlighted ? 1 : 0.26,
            strokeDasharray: base.dash,
            filter: isHierarchy
              ? `drop-shadow(0 0 12px ${base.stroke}55)`
              : 'drop-shadow(0 0 10px rgba(34, 211, 238, 0.24))',
            transition: 'opacity 120ms ease, stroke-width 120ms ease, filter 120ms ease',
          },
        }
      }),
    )
  }, [highlightedRelations, selectedNode, selectionState, setEdges])

  const fitGraph = useCallback(
    (mode = 'all', nodeId = null) => {
      const instance = reactFlowInstanceRef.current
      if (!instance) return

      if (fitTimerRef.current) {
        clearTimeout(fitTimerRef.current)
      }

      fitTimerRef.current = setTimeout(() => {
        const targetNodeId = nodeId || (mode === 'selected' ? selectedNode || focusedNode : null)

        if (mode === 'selected' && targetNodeId) {
          const selectedFlowNode = instance.getNode(targetNodeId)
          if (selectedFlowNode) {
            instance.fitView({
              nodes: [selectedFlowNode],
              padding: FOCUS_PADDING,
              duration: FOCUS_DURATION,
              includeHiddenNodes: false,
            })
            return
          }
        }

        instance.fitView({
          padding: FOCUS_PADDING,
          duration: FOCUS_DURATION,
          includeHiddenNodes: false,
        })
      }, 0)
    },
    [focusedNode, selectedNode],
  )

  useEffect(() => {
    if (reactFlowInstanceRef.current) {
      fitGraph('all')
    }
    return () => {
      if (fitTimerRef.current) {
        clearTimeout(fitTimerRef.current)
      }
    }
  }, [graphSeed.nodes.length, graphSeed.edges.length, fitGraph])

  useEffect(() => {
    const focusNodeId = focusedNode || selectedNode
    if (focusNodeId) {
      centerOnNode(focusNodeId)
      fitGraph('selected', focusNodeId)
    }
  }, [centerOnNode, fitGraph, focusedNode, selectedNode])

  useEffect(() => {
    if (searchQuery && reactFlowInstanceRef.current) {
      fitGraph('all')
    }
  }, [searchQuery, fitGraph])

  const onNodeClick = useCallback(
    (_event, node) => {
      setSelectedNode(node.id)
      const relationIds = edges
        .filter((edge) => edge.source === node.id || edge.target === node.id)
        .map((edge) => edge.id)
      setHighlightedRelations(relationIds)
    },
    [edges, setHighlightedRelations, setSelectedNode],
  )

  const onNodeMouseEnter = useCallback(() => {}, [])

  const onNodeMouseLeave = useCallback(() => {}, [])

  const onMoveEnd = useCallback(
    (_event, viewport) => {
      setZoomState(viewport)
      setViewport(viewport)
    },
    [setViewport, setZoomState],
  )

  const onInit = useCallback(
    (instance) => {
      reactFlowInstanceRef.current = instance
      fitGraph('all')
    },
    [fitGraph],
  )

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }) => {
      if (selectedNodes && selectedNodes.length === 1) {
        setSelectedNode(selectedNodes[0].id)
      }
    },
    [setSelectedNode],
  )

  useEffect(() => {
    const instance = reactFlowInstanceRef.current
    const focusNodeId = focusedNode || selectedNode
    if (!instance || !focusNodeId) return

    const selectedFlowNode = instance.getNode(focusNodeId)
    if (selectedFlowNode) {
      instance.fitView({
        nodes: [selectedFlowNode],
        padding: FOCUS_PADDING,
        duration: FOCUS_DURATION,
        includeHiddenNodes: false,
      })
    }
  }, [focusedNode, selectedNode])

  useEffect(() => {
    return () => {
      if (fitTimerRef.current) {
        clearTimeout(fitTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="graph-canvas" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @keyframes graph-float {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.5; }
          50% { transform: translate3d(0, -12px, 0) scale(1.05); opacity: 0.82; }
        }

        @keyframes graph-sweep {
          0% { transform: translate3d(-2%, 0, 0); opacity: 0.24; }
          50% { transform: translate3d(2%, 0, 0); opacity: 0.38; }
          100% { transform: translate3d(-2%, 0, 0); opacity: 0.24; }
        }

        /* Ensure edges render above node backgrounds and are fully visible */
        .react-flow__edges { z-index: 1 !important; }
        .react-flow__nodes { z-index: 2 !important; }
        .react-flow__edge-path { stroke-opacity: 1 !important; }
      `}</style>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 50% 14%, rgba(168, 85, 247, 0.2), transparent 28%), radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.17), transparent 22%), radial-gradient(circle at 80% 26%, rgba(34, 211, 238, 0.15), transparent 20%), linear-gradient(180deg, rgba(2, 6, 23, 0.42) 0%, rgba(2, 6, 23, 0.58) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.22,
          backgroundImage:
            'radial-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px, 72px 72px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.8), transparent 88%)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 18% 22%, rgba(56, 189, 248, 0.14), transparent 10%), radial-gradient(circle at 78% 30%, rgba(168, 85, 247, 0.12), transparent 11%), radial-gradient(circle at 52% 72%, rgba(34, 211, 238, 0.12), transparent 12%)',
          opacity: 0.9,
          animation: 'graph-sweep 18s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '12%',
          top: '10%',
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(96, 165, 250, 0.16), transparent 68%)',
          filter: 'blur(22px)',
          pointerEvents: 'none',
          animation: 'graph-float 16s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '12%',
          top: '14%',
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.16), transparent 68%)',
          filter: 'blur(28px)',
          pointerEvents: 'none',
          animation: 'graph-float 20s ease-in-out infinite reverse',
        }}
      />
      {selectedNode ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '18% 18% auto 18%',
            height: '42%',
            pointerEvents: 'none',
            borderRadius: 999,
            filter: 'blur(38px)',
            background: 'radial-gradient(circle, rgba(96, 165, 250, 0.2), transparent 72%)',
          }}
        />
      ) : null}
      <ReactFlow
        onInit={onInit}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        minZoom={0.16}
        maxZoom={2.4}
        elevateNodesOnSelect
        nodesDraggable
        nodesConnectable={false}
        panOnDrag
        panOnScroll
        selectionOnDrag={false}
        defaultEdgeOptions={{ type: 'smoothstep', zIndex: 999 }}
        fitView
        fitViewOptions={{ padding: FOCUS_PADDING, duration: FOCUS_DURATION }}
        attributionPosition="bottom-left"
      >
        <Background gap={22} color="rgba(148, 163, 184, 0.16)" />
        <Controls />
      </ReactFlow>
    </div>
  )
}
