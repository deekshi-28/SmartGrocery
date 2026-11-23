import React, { useMemo, useState } from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import { NetworkGraph } from '../components/NetworkGraph';
import { NetworkEdge, NetworkNode } from '../types/analytics';

export const ProductNetworkPage: React.FC = () => {
  const {
    activeDataset,
    productNetwork,
    marketBasket,
    mbaConfig,
    setMbaConfig,
    setSelectedProduct,
    setActivePage,
  } = useAnalytics();

  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<NetworkEdge | null>(null);

  const curr = activeDataset.currencySymbol;

  const nodeConnectedRules = useMemo(() => {
    if (!selectedNode) return [];
    return marketBasket.rules
      .filter((r) => r.antecedents.includes(selectedNode.id) || r.consequents.includes(selectedNode.id))
      .slice(0, 8);
  }, [selectedNode, marketBasket.rules]);

  return (
    <div className="space-y-6">
      {/* Parameter Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Min Lift:</span>
            <input
              type="range"
              min={1.0}
              max={3.5}
              step={0.1}
              value={mbaConfig.minLift}
              onChange={(e) => setMbaConfig((p) => ({ ...p, minLift: Number(e.target.value) }))}
              className="accent-teal-700"
            />
            <span className="font-mono text-teal-700">{mbaConfig.minLift.toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Min Support:</span>
            <input
              type="range"
              min={0.005}
              max={0.06}
              step={0.005}
              value={mbaConfig.minSupport}
              onChange={(e) => setMbaConfig((p) => ({ ...p, minSupport: Number(e.target.value) }))}
              className="accent-teal-700"
            />
            <span className="font-mono text-teal-700">{(mbaConfig.minSupport * 100).toFixed(1)}%</span>
          </div>
        </div>
        <div className="font-mono text-slate-500 tabular-nums">
          {productNetwork.nodes.length} product nodes · {productNetwork.edges.length} association edges
        </div>
      </section>

      {/* Main Graph + Inspector */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8">
          <NetworkGraph
            nodes={productNetwork.nodes}
            edges={productNetwork.edges}
            selectedNodeId={selectedNode?.id || null}
            selectedEdgeId={selectedEdge?.id || null}
            onSelectNode={(n) => setSelectedNode(n)}
            onSelectEdge={(e) => setSelectedEdge(e)}
            currencySymbol={curr}
          />
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Network Inspector
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any product node or connecting edge on the graph to inspect metrics.
          </p>

          {selectedNode ? (
            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-teal-700 font-medium">{selectedNode.category}</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">{selectedNode.label}</div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Basket Appearances</span>
                  <span className="font-mono font-medium text-slate-900">{selectedNode.frequency}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Item Support</span>
                  <span className="font-mono font-medium text-slate-900">
                    {(selectedNode.support * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Connected Neighbors</span>
                  <span className="font-mono font-medium text-slate-900">{selectedNode.degree}</span>
                </div>
                {selectedNode.revenue !== null && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Total Revenue</span>
                    <span className="font-mono font-medium text-slate-900">
                      {curr}{selectedNode.revenue.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <div className="font-medium text-slate-800 mb-1.5">Connected Rules</div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {nodeConnectedRules.map((r) => (
                    <div key={r.id} className="p-2 rounded-md bg-slate-50 border border-slate-200/70">
                      <div className="font-medium text-slate-800">
                        {r.antecedentLabel} -&gt; {r.consequentLabel}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        Lift {r.lift.toFixed(2)}x · Conf {(r.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedProduct(selectedNode.label);
                  setActivePage('products');
                }}
                className="w-full py-2 px-3 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
              >
                Open Full SKU Drill-Down
              </button>
            </div>
          ) : selectedEdge ? (
            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-teal-700 font-medium">Product Association Edge</div>
                <div className="text-sm font-semibold text-slate-900 mt-1">
                  {selectedEdge.source} &lt;-&gt; {selectedEdge.target}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Lift Strength</span>
                  <span className="font-mono font-semibold text-teal-700">
                    {selectedEdge.lift.toFixed(3)}x
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Confidence</span>
                  <span className="font-mono font-medium text-slate-900">
                    {(selectedEdge.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Pair Support</span>
                  <span className="font-mono font-medium text-slate-900">
                    {(selectedEdge.support * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Co-Occurring Baskets</span>
                  <span className="font-mono font-medium text-slate-900">
                    {selectedEdge.coOccurrence}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              Select a node to view its basket support and linked products, or click an edge line to inspect exact Lift and Confidence metrics.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
