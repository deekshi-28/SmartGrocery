import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, RotateCcw, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { NetworkEdge, NetworkNode } from '../types/analytics';

interface NetworkGraphProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (node: NetworkNode | null) => void;
  onSelectEdge: (edge: NetworkEdge | null) => void;
  currencySymbol: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Dairy & Eggs': '#0d9488',
  'Fresh Produce': '#16a34a',
  Bakery: '#d97706',
  Beverages: '#2563eb',
  'Pantry & Grains': '#7c3aed',
  'Snacks & Confectionery': '#e11d48',
  'Meat & Seafood': '#dc2626',
  'Frozen Foods': '#0284c7',
  'Household & Cleaning': '#475569',
};

function getCategoryColor(cat: string): string {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  const palette = ['#0d9488', '#2563eb', '#d97706', '#16a34a', '#e11d48', '#0284c7', '#475569'];
  return palette[Math.abs(hash) % palette.length];
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  currencySymbol,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => {
      pos[n.id] = { x: n.x, y: n.y };
    });
    setNodePositions(pos);
  }, [nodes]);

  const categories = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.category))).sort(),
    [nodes]
  );

  const maxFreq = useMemo(() => Math.max(1, ...nodes.map((n) => n.frequency)), [nodes]);
  const maxLift = useMemo(() => Math.max(1.5, ...edges.map((e) => e.lift)), [edges]);

  const matchedNodeIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return new Set(
      nodes
        .filter((n) => {
          const catOk = categoryFilter === 'ALL' || n.category === categoryFilter;
          const qOk = !q || n.label.toLowerCase().includes(q) || n.category.toLowerCase().includes(q);
          return catOk && qOk;
        })
        .map((n) => n.id)
    );
  }, [nodes, searchQuery, categoryFilter]);

  const activeFocusId = hoveredNode || selectedNodeId;
  const connectedNeighbors = useMemo(() => {
    if (!activeFocusId) return new Set<string>();
    const set = new Set<string>([activeFocusId]);
    edges.forEach((e) => {
      if (e.source === activeFocusId) set.add(e.target);
      if (e.target === activeFocusId) set.add(e.source);
    });
    return set;
  }, [activeFocusId, edges]);

  const getSvgCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const viewX = ((clientX - rect.left) / rect.width) * 900;
    const viewY = ((clientY - rect.top) / rect.height) * 560;
    return {
      x: (viewX - 450 - pan.x) / zoom + 450,
      y: (viewY - 280 - pan.y) / zoom + 280,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingNode) {
      const pt = getSvgCoords(e.clientX, e.clientY);
      setNodePositions((prev) => ({
        ...prev,
        [draggingNode]: {
          x: Math.max(40, Math.min(860, pt.x)),
          y: Math.max(40, Math.min(520, pt.y)),
        },
      }));
    } else if (panning) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = ((e.clientX - panning.startX) / rect.width) * 900;
      const dy = ((e.clientY - panning.startY) / rect.height) * 560;
      setPan({ x: panning.origX + dx, y: panning.origY + dy });
    }
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
    setPanning(null);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    const pos: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => {
      pos[n.id] = { x: n.x, y: n.y };
    });
    setNodePositions(pos);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Graph Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/70">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search node..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600 w-44"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter network by category"
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.6, Number((z + 0.2).toFixed(2))))}
            title="Zoom in"
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
            title="Zoom out"
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={resetView}
            title="Reset zoom and node positions"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset View
          </button>
          <span className="ml-1 text-xs font-mono tabular-nums text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative bg-slate-50/40 select-none">
        {nodes.length === 0 ? (
          <div className="h-[460px] flex flex-col items-center justify-center text-center p-6">
            <Maximize2 className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-700">No network associations match current thresholds</p>
            <p className="text-xs text-slate-500 mt-1">
              Lower the minimum support, confidence, or lift parameters to generate product network edges.
            </p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox="0 0 900 560"
            className="w-full h-[500px] cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
              if (e.target === svgRef.current) {
                setPanning({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y });
                onSelectNode(null);
                onSelectEdge(null);
              }
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <g transform={`translate(${450 + pan.x}, ${280 + pan.y}) scale(${zoom}) translate(-450, -280)`}>
              {/* Edges */}
              {edges.map((edge) => {
                const p1 = nodePositions[edge.source];
                const p2 = nodePositions[edge.target];
                if (!p1 || !p2) return null;

                const isSelected = selectedEdgeId === edge.id;
                const matchesFilter = matchedNodeIds.has(edge.source) && matchedNodeIds.has(edge.target);
                const focusHighlight =
                  !activeFocusId || (edge.source === activeFocusId || edge.target === activeFocusId);

                const strokeWidth = 1.2 + Math.min(5, ((edge.lift - 1) / Math.max(0.5, maxLift - 1)) * 4.5);
                const opacity = !matchesFilter
                  ? 0.08
                  : isSelected
                    ? 1
                    : focusHighlight
                      ? 0.72
                      : 0.14;

                return (
                  <g key={edge.id}>
                    {/* Wider invisible hit target */}
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke="transparent"
                      strokeWidth={12}
                      className="cursor-pointer"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelectNode(null);
                        onSelectEdge(edge);
                      }}
                    />
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={isSelected ? '#0f172a' : focusHighlight && activeFocusId ? '#0d9488' : '#94a3b8'}
                      strokeWidth={isSelected ? strokeWidth + 1.5 : strokeWidth}
                      strokeOpacity={opacity}
                      strokeLinecap="round"
                      className="pointer-events-none transition-opacity duration-150"
                    />
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const pos = nodePositions[node.id] || { x: node.x, y: node.y };
                const radius = 8 + (node.frequency / maxFreq) * 14;
                const color = getCategoryColor(node.category);
                const isSelected = selectedNodeId === node.id;
                const matchesFilter = matchedNodeIds.has(node.id);
                const focusOk = !activeFocusId || connectedNeighbors.has(node.id);
                const dimmed = !matchesFilter || !focusOk;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                    style={{ opacity: dimmed ? 0.2 : 1 }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onMouseDown={(ev) => {
                      ev.stopPropagation();
                      setDraggingNode(node.id);
                    }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelectEdge(null);
                      onSelectNode(node);
                    }}
                  >
                    <circle
                      r={radius + (isSelected ? 4 : 0)}
                      fill={color}
                      fillOpacity={0.92}
                      stroke={isSelected ? '#0f172a' : '#ffffff'}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    <text
                      y={radius + 13}
                      textAnchor="middle"
                      className="text-[10px] font-medium fill-slate-700 pointer-events-none"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        paintOrder: 'stroke',
                        stroke: '#ffffff',
                        strokeWidth: 3,
                        strokeLinejoin: 'round',
                      }}
                    >
                      {node.label.length > 22 ? `${node.label.slice(0, 20)}...` : node.label}
                    </text>
                    <title>
                      {`${node.label}\nCategory: ${node.category}\nBaskets: ${node.frequency} (${(node.support * 100).toFixed(1)}%)\nConnections: ${node.degree}${node.revenue !== null ? `\nRevenue: ${currencySymbol}${node.revenue.toLocaleString()}` : ''}`}
                    </title>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        <div className="px-4 py-2.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {categories.map((cat) => (
              <span key={cat} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: getCategoryColor(cat) }}
                />
                <span>{cat}</span>
              </span>
            ))}
          </div>
          <div className="text-slate-500">
            Node size = Basket frequency · Edge thickness = Lift strength · Drag nodes or click edges/nodes to inspect
          </div>
        </div>
      </div>
    </div>
  );
};
