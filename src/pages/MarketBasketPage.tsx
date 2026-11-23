import React, { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { useAnalytics } from '../context/AnalyticsContext';
import { KpiCard } from '../components/KpiCard';
import { PlotlyChart } from '../components/PlotlyChart';

export const MarketBasketPage: React.FC = () => {
  const { mbaConfig, setMbaConfig, marketBasket, setActivePage } = useAnalytics();
  const [productFilter, setProductFilter] = useState('');

  const filteredRules = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return marketBasket.rules;
    return marketBasket.rules.filter(
      (r) =>
        r.antecedentLabel.toLowerCase().includes(q) ||
        r.consequentLabel.toLowerCase().includes(q)
    );
  }, [marketBasket.rules, productFilter]);

  const topRule = filteredRules[0];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Baskets Mined"
          value={marketBasket.totalBaskets.toLocaleString()}
          subtext="Unique transaction sets"
        />
        <KpiCard
          label="Association Rules Mined"
          value={filteredRules.length.toString()}
          subtext={`Max lift ${topRule ? `${topRule.lift.toFixed(2)}x` : '—'}`}
        />
        <KpiCard
          label="Frequent 2-Item Pairs"
          value={marketBasket.frequentPairs.length.toString()}
          subtext="Meeting min support"
        />
        <KpiCard
          label="3-Item Product Bundles"
          value={marketBasket.frequentTriples.length.toString()}
          subtext="Multi-item combinations"
        />
      </section>

      {/* Association Parameter Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Apriori Association Mining Parameters
            </h2>
            <p className="text-xs text-slate-500">
              Adjust Support, Confidence, and Lift thresholds dynamically to recalculate product rules and the association network.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('network')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            Open Product Network <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Minimum Support</span>
              <span className="font-mono text-teal-700">{(mbaConfig.minSupport * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={0.005}
              max={0.08}
              step={0.005}
              value={mbaConfig.minSupport}
              onChange={(e) =>
                setMbaConfig((prev) => ({ ...prev, minSupport: Number(e.target.value) }))
              }
              className="w-full accent-teal-700"
            />
            <div className="text-[11px] text-slate-400 mt-0.5">
              Fraction of all baskets containing both items
            </div>
          </div>

          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Minimum Confidence</span>
              <span className="font-mono text-teal-700">{(mbaConfig.minConfidence * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.8}
              step={0.05}
              value={mbaConfig.minConfidence}
              onChange={(e) =>
                setMbaConfig((prev) => ({ ...prev, minConfidence: Number(e.target.value) }))
              }
              className="w-full accent-teal-700"
            />
            <div className="text-[11px] text-slate-400 mt-0.5">
              P(Consequent | Antecedent) conditional probability
            </div>
          </div>

          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Minimum Lift</span>
              <span className="font-mono text-teal-700">{mbaConfig.minLift.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={4.0}
              step={0.1}
              value={mbaConfig.minLift}
              onChange={(e) =>
                setMbaConfig((prev) => ({ ...prev, minLift: Number(e.target.value) }))
              }
              className="w-full accent-teal-700"
            />
            <div className="text-[11px] text-slate-400 mt-0.5">
              Strength above random independent co-occurrence (&gt;1.0)
            </div>
          </div>
        </div>
      </section>

      {/* Support vs Confidence Scatter + Bundles */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Association Rules Matrix: Support vs Confidence (Sized by Lift)
          </h3>
          <p className="text-xs text-slate-500">
            Top-right rules represent high-frequency, high-probability cross-selling links
          </p>
          <PlotlyChart
            height={320}
            data={[
              {
                x: filteredRules.map((r) => Number((r.support * 100).toFixed(2))),
                y: filteredRules.map((r) => Number((r.confidence * 100).toFixed(1))),
                text: filteredRules.map(
                  (r) => `${r.antecedentLabel} -> ${r.consequentLabel} (Lift ${r.lift.toFixed(2)}x)`
                ),
                mode: 'markers',
                type: 'scatter',
                marker: {
                  size: filteredRules.map((r) => Math.min(24, Math.max(7, r.lift * 4))),
                  color: filteredRules.map((r) => r.lift),
                  colorscale: 'Teal',
                  showscale: true,
                  colorbar: { title: 'Lift' },
                },
              },
            ]}
            layout={{
              margin: { l: 55, r: 20, t: 18, b: 48 },
              xaxis: { title: 'Support (%)', gridcolor: '#f1f5f9' },
              yaxis: { title: 'Confidence (%)', gridcolor: '#f1f5f9' },
            }}
          />
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Top Frequently Bought Together Bundles
          </h3>
          <div className="space-y-2.5 max-h-[320px] overflow-y-auto">
            {marketBasket.frequentTriples.length > 0 ? (
              marketBasket.frequentTriples.slice(0, 8).map((t, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                >
                  <div className="font-medium text-slate-900">
                    {t.items.join(' + ')}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>{t.count} co-occurring baskets</span>
                    <span className="text-teal-700 font-medium">
                      Support {(t.support * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              marketBasket.frequentPairs.slice(0, 8).map((p, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                >
                  <div className="font-medium text-slate-900">
                    {p.items[0]} + {p.items[1]}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>{p.count} co-occurring baskets</span>
                    <span className="text-teal-700 font-medium">
                      Support {(p.support * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Association Rules Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Mined Association Rules ({filteredRules.length})
          </h3>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              placeholder="Search antecedent or consequent..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600 w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 text-left font-medium">Antecedent (If Bought)</th>
                <th className="py-2 text-left font-medium">Consequent (Also Bought)</th>
                <th className="py-2 text-right font-medium">Baskets</th>
                <th className="py-2 text-right font-medium">Support</th>
                <th className="py-2 text-right font-medium">Confidence</th>
                <th className="py-2 text-right font-medium">Lift</th>
                <th className="py-2 text-right font-medium">Conviction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRules.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-2.5 font-medium text-slate-900">{r.antecedentLabel}</td>
                  <td className="py-2.5 font-medium text-teal-800">{r.consequentLabel}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-slate-600">
                    {r.coOccurrenceCount}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {(r.support * 100).toFixed(2)}%
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {(r.confidence * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-teal-700">
                    {r.lift.toFixed(2)}x
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-slate-600">
                    {r.conviction.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
