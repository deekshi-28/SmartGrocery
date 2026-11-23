import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAnalytics } from '../context/AnalyticsContext';
import { PlotlyChart } from '../components/PlotlyChart';
import { OpportunityQuadrant } from '../types/analytics';

export const RecommendationsPage: React.FC = () => {
  const {
    recommendations,
    opportunityMatrix,
    setSelectedProduct,
    setActivePage,
  } = useAnalytics();

  const [typeFilter, setTypeFilter] = useState<
    'ALL' | 'Cross-Selling' | 'Product Bundle' | 'Category Promotion' | 'Inventory Action'
  >('ALL');

  const filteredRecs = useMemo(
    () =>
      typeFilter === 'ALL'
        ? recommendations
        : recommendations.filter((r) => r.type === typeFilter),
    [recommendations, typeFilter]
  );

  const quadrants: { name: OpportunityQuadrant; color: string; desc: string }[] = [
    {
      name: 'Stars (High Performance & Growth)',
      color: '#0d9488',
      desc: 'High sales/frequency and above-median growth or reorder rate. Prioritize stock availability and hero placement.',
    },
    {
      name: 'Core Staples (High Volume, Mature)',
      color: '#2563eb',
      desc: 'Strong baseline volume with stable/lower growth. Anchor cross-sell bundles to lift basket size.',
    },
    {
      name: 'Rising Opportunities (Emerging Growth)',
      color: '#16a34a',
      desc: 'Lower current volume but strong upward momentum. Ideal candidates for featured promos and end-caps.',
    },
    {
      name: 'Watchlist (Low Volume & Declining)',
      color: '#d97706',
      desc: 'Below-median volume and momentum. Review pricing, pack size, or clearance bundling.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Product Opportunity Matrix */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 font-display">
              Product Opportunity Matrix
            </h2>
            <p className="text-xs text-slate-500">
              Comparing SKUs by {opportunityMatrix.xAxisLabel} (X-axis) vs {opportunityMatrix.yAxisLabel} (Y-axis). Dashed lines mark dataset medians.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('simulator')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            Test in Promo Simulator <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <PlotlyChart
          height={360}
          data={quadrants.map((q) => {
            const pts = opportunityMatrix.points.filter((p) => p.quadrant === q.name);
            return {
              x: pts.map((p) => p.xValue),
              y: pts.map((p) => p.yValue),
              text: pts.map((p) => `${p.productName} (${p.category})`),
              mode: 'markers',
              type: 'scatter',
              name: q.name,
              marker: {
                size: pts.map((p) => Math.min(24, Math.max(8, Math.sqrt(p.sizeValue) * 1.4))),
                color: q.color,
                opacity: 0.85,
                line: { color: '#ffffff', width: 1 },
              },
            };
          })}
          layout={{
            margin: { l: 58, r: 20, t: 18, b: 50 },
            xaxis: { title: opportunityMatrix.xAxisLabel, gridcolor: '#f1f5f9' },
            yaxis: { title: opportunityMatrix.yAxisLabel, gridcolor: '#f1f5f9' },
            shapes: [
              {
                type: 'line',
                x0: opportunityMatrix.xMedian,
                x1: opportunityMatrix.xMedian,
                yref: 'paper',
                y0: 0,
                y1: 1,
                line: { color: '#94a3b8', width: 1.5, dash: 'dot' },
              },
              {
                type: 'line',
                xref: 'paper',
                x0: 0,
                x1: 1,
                y0: opportunityMatrix.yMedian,
                y1: opportunityMatrix.yMedian,
                line: { color: '#94a3b8', width: 1.5, dash: 'dot' },
              },
            ],
            legend: { orientation: 'h', y: -0.22 },
          }}
          onPointClick={(ev) => {
            const txt = ev?.points?.[0]?.text;
            if (txt) {
              const name = String(txt).replace(/\s*\([^)]*\)$/, '');
              setSelectedProduct(name);
              setActivePage('products');
            }
          }}
        />

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
          {quadrants.map((q) => (
            <div key={q.name} className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: q.color }}
                />
                <span className="truncate">{q.name}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">{q.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Actionable Recommendations List */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Automated Retail Recommendations ({filteredRecs.length})
            </h3>
            <p className="text-xs text-slate-500">
              Cross-selling pairings, 3-item bundles, category campaigns, and inventory actions computed from live data
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
            {(
              ['ALL', 'Cross-Selling', 'Product Bundle', 'Category Promotion', 'Inventory Action'] as const
            ).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                  typeFilter === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecs.map((rec) => (
            <div
              key={rec.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-teal-700">{rec.type}</span>
                  <span className="font-mono text-[11px] text-slate-500">{rec.metricsLabel}</span>
                </div>
                <h4 className="mt-1.5 text-sm font-semibold text-slate-900">{rec.title}</h4>
                <p className="mt-1 text-xs text-slate-700 leading-relaxed">{rec.summary}</p>
                <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                  Rationale: {rec.rationale}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-xs">
                <span className="text-slate-500">{rec.category}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (rec.type === 'Category Promotion') {
                      setActivePage('categories');
                    } else {
                      setSelectedProduct(rec.primaryProduct);
                      setActivePage('products');
                    }
                  }}
                  className="font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
                >
                  Inspect <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
