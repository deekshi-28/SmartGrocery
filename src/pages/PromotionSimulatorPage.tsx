import React, { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAnalytics } from '../context/AnalyticsContext';
import { runPromotionSimulation } from '../analytics/intelligence';
import { KpiCard } from '../components/KpiCard';
import { PlotlyChart } from '../components/PlotlyChart';
import { SimulationConfig } from '../types/analytics';

export const PromotionSimulatorPage: React.FC = () => {
  const {
    activeDataset,
    capabilities,
    cleanedTransactions,
    productAnalytics,
    categoryAnalytics,
    marketBasket,
  } = useAnalytics();

  const curr = activeDataset.currencySymbol;
  const [targetScope, setTargetScope] = useState<'product' | 'category'>('product');
  const [selectedProd, setSelectedProd] = useState<string>(
    productAnalytics[0]?.productName || ''
  );
  const [selectedCat, setSelectedCat] = useState<string>(
    categoryAnalytics[0]?.category || ''
  );
  const [discountPct, setDiscountPct] = useState<number>(15);
  const [promotionType, setPromotionType] = useState<SimulationConfig['promotionType']>(
    'Percentage Discount'
  );
  const [durationDays, setDurationDays] = useState<number>(14);

  const effectiveProd = productAnalytics.some((p) => p.productName === selectedProd)
    ? selectedProd
    : productAnalytics[0]?.productName || '';
  const effectiveCat = categoryAnalytics.some((c) => c.category === selectedCat)
    ? selectedCat
    : categoryAnalytics[0]?.category || '';

  const simResult = useMemo(
    () =>
      runPromotionSimulation(
        {
          targetScope,
          productName: effectiveProd,
          categoryName: effectiveCat,
          discountPct,
          promotionType,
          durationDays,
        },
        cleanedTransactions,
        productAnalytics,
        categoryAnalytics,
        marketBasket.rules,
        capabilities
      ),
    [
      targetScope,
      effectiveProd,
      effectiveCat,
      discountPct,
      promotionType,
      durationDays,
      cleanedTransactions,
      productAnalytics,
      categoryAnalytics,
      marketBasket.rules,
      capabilities,
    ]
  );

  const fmtMetric = (val: number) =>
    capabilities.hasRevenue
      ? `${curr}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${val.toLocaleString()} orders`;

  return (
    <div className="space-y-6">
      {/* Explicit Hypothetical Estimate Banner */}
      <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Hypothetical Scenario Simulation (Estimate Only):</span>{' '}
          All projected lifts below are scenario estimates computed from your historical baseline using a price-elasticity model (ε={simResult.elasticityUsed.toFixed(2)}) and mined association attach rates. They are not actual historical outcomes.
        </div>
      </section>

      {/* Controls + KPI Results */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
          <div>
            <h2 className="text-base font-semibold text-slate-900 font-display">
              What-If Promotion Parameters
            </h2>
            <p className="text-slate-500 mt-0.5">
              Adjust scope, discount depth, and campaign type to model estimated uplift.
            </p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1.5">Target Scope</label>
            <div className="flex p-1 bg-slate-100 rounded-lg">
              {(['product', 'category'] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setTargetScope(sc)}
                  className={`flex-1 py-1.5 rounded-md font-medium capitalize ${
                    targetScope === sc ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Single {sc}
                </button>
              ))}
            </div>
          </div>

          {targetScope === 'product' ? (
            <div>
              <label className="block font-medium text-slate-700 mb-1">Select Product</label>
              <select
                value={effectiveProd}
                onChange={(e) => setSelectedProd(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              >
                {productAnalytics.map((p) => (
                  <option key={p.productName} value={p.productName}>
                    {p.productName} ({p.category})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block font-medium text-slate-700 mb-1">Select Category</label>
              <select
                value={effectiveCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              >
                {categoryAnalytics.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-700 mb-1">Promotion Type</label>
            <select
              value={promotionType}
              onChange={(e) => setPromotionType(e.target.value as SimulationConfig['promotionType'])}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="Percentage Discount">Percentage Discount</option>
              <option value="Bundle Offer (Buy 2 Get Discount)">Bundle Offer (Buy 2 Get Discount)</option>
              <option value="Featured Display Placement">Featured Display Placement</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Discount Depth</span>
              <span className="font-mono text-teal-700">{discountPct}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={45}
              step={5}
              value={discountPct}
              onChange={(e) => setDiscountPct(Number(e.target.value))}
              className="w-full accent-teal-700"
            />
          </div>

          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Campaign Duration</span>
              <span className="font-mono text-teal-700">{durationDays} days</span>
            </div>
            <input
              type="range"
              min={7}
              max={30}
              step={1}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="w-full accent-teal-700"
            />
          </div>
        </div>

        <div className="lg:col-span-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Baseline Units (Est.)"
              value={simResult.baselineUnits.toLocaleString()}
              subtext={`Over ${durationDays} days`}
            />
            <KpiCard
              label="Simulated Units (Est.)"
              value={simResult.projectedUnits.toLocaleString()}
              trendText={`+${simResult.unitLiftPct}%`}
              trendTone="positive"
              subtext="Estimated demand lift"
            />
            <KpiCard
              label={`${simResult.metricLabel} (Est.)`}
              value={fmtMetric(simResult.projectedMetricValue)}
              trendText={`${simResult.netMetricDeltaPct >= 0 ? '+' : ''}${simResult.netMetricDeltaPct}%`}
              trendTone={simResult.netMetricDeltaPct >= 0 ? 'positive' : 'negative'}
              subtext={`vs ${fmtMetric(simResult.baselineMetricValue)} baseline`}
            />
            <KpiCard
              label="Halo Cross-Sell Units (Est.)"
              value={`+${simResult.haloCrossSellLiftUnits.toLocaleString()}`}
              subtext="Linked association items"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Baseline vs Hypothetical Promotion Scenario ({durationDays}-Day Window)
            </h3>
            <p className="text-xs text-slate-500">{simResult.marginImpactNote}</p>

            <PlotlyChart
              height={310}
              data={[
                {
                  x: simResult.dailyComparison.map((d) => d.day),
                  y: simResult.dailyComparison.map((d) => d.baseline),
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Historical Baseline (Scaled)',
                  line: { color: '#64748b', width: 2 },
                },
                {
                  x: simResult.dailyComparison.map((d) => d.day),
                  y: simResult.dailyComparison.map((d) => d.simulated),
                  type: 'scatter',
                  mode: 'lines+markers',
                  name: 'Simulated Estimate (Hypothetical)',
                  line: { color: '#0d9488', width: 2.5, dash: 'dash' },
                  marker: { size: 5, color: '#0d9488' },
                },
              ]}
              layout={{
                margin: { l: 55, r: 20, t: 18, b: 46 },
                xaxis: { title: 'Campaign Day', gridcolor: '#f1f5f9' },
                yaxis: {
                  title: capabilities.hasRevenue ? `Daily Revenue (${curr})` : 'Daily Orders',
                  gridcolor: '#f1f5f9',
                },
                legend: { orientation: 'h', y: -0.2 },
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
};
