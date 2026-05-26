import { create } from 'zustand'

const DEFAULT_FILTERS = {
  relationTypes: {
    parent_child: true,
    related_to: true,
    prerequisite: true,
    depends_on: true,
    leads_to: true,
    part_of: true,
  },
  showHierarchy: true,
  showSemantic: true,
}

export const useMapStore = create((set, get) => ({
  topicMap: {},
  selectedNode: null,
  highlightedRelations: [],
  expandedNodes: {},
  focusedNode: null,
  visibleNodeIds: [],
  graphFilters: DEFAULT_FILTERS,
  searchQuery: '',
  graphLayout: 'LR',
  zoomState: { x: 0, y: 0, zoom: 1 },
  viewport: { x: 0, y: 0, zoom: 1 },
  centeredNodeId: null,

  // Backward compatible aliases for legacy consumers.
  expanded: {},
  zoom: { x: 0, y: 0, zoom: 1 },

  setTopicMap: (map) => set({ topicMap: map || {} }),
  setSelectedNode: (id) => set({ selectedNode: id || null, focusedNode: id || null }),
  toggleExpanded: (id) =>
    set((state) => {
      const next = { ...state.expandedNodes, [id]: !state.expandedNodes[id] }
      return { expandedNodes: next, expanded: next }
    }),
  setExpandedNodes: (mapOrUpdater) =>
    set((state) => {
      const next = typeof mapOrUpdater === 'function' ? mapOrUpdater(state.expandedNodes) : mapOrUpdater
      const safe = next || {}
      return { expandedNodes: safe, expanded: safe }
    }),
  setExpanded: (mapOrUpdater) =>
    set((state) => {
      const next = typeof mapOrUpdater === 'function' ? mapOrUpdater(state.expandedNodes) : mapOrUpdater
      const safe = next || {}
      return { expandedNodes: safe, expanded: safe }
    }),
  setHighlightedRelations: (edgeIds) => {
    const normalized = Array.isArray(edgeIds) ? edgeIds : edgeIds ? Array.from(edgeIds) : []
    set({ highlightedRelations: normalized })
  },
  setVisibleNodeIds: (ids) => {
    const next = Array.isArray(ids) ? ids : []
    set((state) => {
      const focused = state.focusedNode && next.includes(state.focusedNode) ? state.focusedNode : next[0] || null
      return { visibleNodeIds: next, focusedNode: focused }
    })
  },
  setFocusedNode: (id) => set({ focusedNode: id || null }),
  focusNext: () =>
    set((state) => {
      if (!state.visibleNodeIds.length) return state
      const current = state.focusedNode ? state.visibleNodeIds.indexOf(state.focusedNode) : -1
      const nextIndex = Math.min(state.visibleNodeIds.length - 1, current + 1)
      const nextNode = state.visibleNodeIds[nextIndex]
      return { focusedNode: nextNode, selectedNode: nextNode }
    }),
  focusPrev: () =>
    set((state) => {
      if (!state.visibleNodeIds.length) return state
      const current = state.focusedNode ? state.visibleNodeIds.indexOf(state.focusedNode) : 0
      const nextIndex = Math.max(0, current - 1)
      const nextNode = state.visibleNodeIds[nextIndex]
      return { focusedNode: nextNode, selectedNode: nextNode }
    }),
  setSearchQuery: (query) => set({ searchQuery: query || '' }),
  setGraphLayout: (layout) => set({ graphLayout: layout || 'LR' }),
  setGraphFilters: (patch) =>
    set((state) => ({
      graphFilters: {
        ...state.graphFilters,
        ...(patch || {}),
        relationTypes: {
          ...state.graphFilters.relationTypes,
          ...((patch && patch.relationTypes) || {}),
        },
      },
    })),
  setZoomState: (viewport) => {
    const next = viewport || { x: 0, y: 0, zoom: 1 }
    set({ zoomState: next, viewport: next, zoom: next })
  },
  setZoom: (viewport) => {
    const next = viewport || { x: 0, y: 0, zoom: 1 }
    set({ zoomState: next, viewport: next, zoom: next })
  },
  setViewport: (viewport) => {
    const next = viewport || { x: 0, y: 0, zoom: 1 }
    set({ zoomState: next, viewport: next, zoom: next })
  },
  centerOnNode: (nodeId) => set({ centeredNodeId: nodeId || null }),
  resetMapState: () =>
    set({
      selectedNode: null,
      highlightedRelations: [],
      expandedNodes: {},
      expanded: {},
      focusedNode: null,
      visibleNodeIds: [],
      searchQuery: '',
      graphLayout: 'LR',
      zoomState: { x: 0, y: 0, zoom: 1 },
      viewport: { x: 0, y: 0, zoom: 1 },
      zoom: { x: 0, y: 0, zoom: 1 },
      centeredNodeId: null,
      graphFilters: DEFAULT_FILTERS,
    }),
  getVisibleIndex: () => {
    const { visibleNodeIds, focusedNode } = get()
    if (!visibleNodeIds.length || !focusedNode) return -1
    return visibleNodeIds.indexOf(focusedNode)
  },
}))

export default useMapStore
