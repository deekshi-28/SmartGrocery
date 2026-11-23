import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useAnalytics } from '../context/AnalyticsContext';
import { KpiCard } from '../components/KpiCard';
import { PlotlyChart } from '../components/PlotlyChart';
import { VelocityTier } from '../types/analytics';

export const ProductAnalyticsPage: React.FC = () => {
  const {
    activeDataset,
    capabilities,
    productAnalytics,
    cleanedTransactions,
    marketBasket,
    selectedProduct,
    setSelectedProduct,
  } = useAnalytics();

  const curr = activeDataset.currencySymbol;
  const fmtMoney = (v: number | null) =>
    v === null ? 'N/A' : `${curr}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | VelocityTier>('ALL');

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productAnalytics.filter((p) => {
      if (tierFilter !== 'ALL' && p.velocityTier !== tierFilter) return false;
      if (q && !p.productName.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [productAnalytics, search, tierFilter]);

  const activeProd = useMemo(
    () =>
      productAnalytics.find((p) => p.productName === selectedProduct) ||
      filteredProducts[0] ||
      productAnalytics[0] ||
      null,
    [productAnalytics, filteredProducts, selectedProduct]
  );

  // Drill-down trend + co-purchased rules for activeProd
  const drillDownSeries = useMemo(() => {
    if (!activeProd) return { labels: [], values: [] };
    const prodTx = cleanedTransactions.filter((t) => t.productName === activeProd.productName);
    if (capabilities.hasDate) {
      const monthMap = new Map<string, number>();
      prodTx.forEach((t) => {
        if (!t.purchaseDate) return;
        const m = t.purchaseDate.slice(0, 7);
        monthMap.set(m, (monthMap.get(m) ?? 0) + (capabilities.hasRevenue ? (t.revenue ?? 0) : t.quantity));
      });
      const labels = Array.from(monthMap.keys()).sort();
      return { labels, values: labels.map((l) => Number((monthMap.get(l) ?? 0).toFixed(2))) };
    }

    const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dowCounts = Array(7).fill(0);
    prodTx.forEach((t) => {
      if (t.dayOfWeekIndex !== null) dowCounts[t.dayOfWeekIndex] += t.quantity;
    });
    return { labels: dowNames, values: dowCounts };
  }, [activeProd, cleanedTransactions, capabilities.hasDate, capabilities.hasRevenue]);

  const linkedRules = useMemo(() => {
    if (!activeProd) return [];
    return marketBasket.rules
      .filter((r) => r.antecedents.includes(activeProd.productName))
      .slice(0, 5);
  }, [activeProd, marketBasket.rules]);

  const fastCount = productAnalytics.filter((p) => p.velocityTier === 'Fast-Moving').length;
  const steadyCount = productAnalytics.filter((p) => p.velocityTier === 'Steady').length;
  const slowCount = productAnalytics.filter((p) => p.velocityTier === 'Slow-Moving').length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total SKUs" value={productAnalytics.length.toString()} subtext="Unique standardized products" />
        <KpiCard
          label="Fast-Moving SKUs"
          value={fastCount.toString()}
          subtext="Top 28% velocity tier"
          trendTone="positive"
        />
        <KpiCard label="Steady SKUs" value={steadyCount.toString()} subtext="Mid-tier consistent demand" />
        <KpiCard label="Slow-Moving SKUs" value={slowCount.toString()} subtext="Bottom 28% velocity tier" />
      </section>

      {/* Top 12 Products Comparison Chart */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900">
          Top 12 Products by {capabilities.hasRevenue ? 'Revenue' : 'Order Frequency'}
        </h3>
        <p className="text-xs text-slate-500">
          Click any bar to inspect individual product drill-down metrics below
        </p>
        <PlotlyChart
          height={320}
          data={[
            {
              x: productAnalytics.slice(0, 12).map((p) => p.productName),
              y: productAnalytics
                .slice(0, 12)
                .map((p) => (capabilities.hasRevenue ? (p.totalRevenue ?? 0) : p.transactionCount)),
              type: 'bar',
              marker: {
                color: productAnalytics
                  .slice(0, 12)
                  .map((p) => (p.productName === activeProd?.productName ? '#0f172a' : '#0d9488')),
              },
            },
          ]}
          layout={{
            margin: { l: 55, r: 20, t: 18, b: 92 },
            xaxis: { tickangle: -28 },
            yaxis: {
              title: capabilities.hasRevenue ? `Revenue (${curr})` : 'Basket Count',
              gridcolor: '#f1f5f9',
            },
          }}
          onPointClick={(ev) => {
            const name = ev?.points?.[0]?.x;
            if (name) setSelectedProduct(String(name));
          }}
        />
      </section>

      {/* Ranking Table + Product Drill-Down Panel */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter products..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600 w-52"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              {(['ALL', 'Fast-Moving', 'Steady', 'Slow-Moving'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTierFilter(tier)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                    tierFilter === tier ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">#</th>
                  <th className="py-2 text-left font-medium">Product</th>
                  <th className="py-2 text-left font-medium">Category</th>
                  <th className="py-2 text-left font-medium">Velocity</th>
                  <th className="py-2 text-right font-medium">Units</th>
                  <th className="py-2 text-right font-medium">Penetration</th>
                  {capabilities.hasRevenue && <th className="py-2 text-right font-medium">Revenue</th>}
                  {capabilities.hasReorder && <th className="py-2 text-right font-medium">Reorder %</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <tr
                    key={p.productName}
                    onClick={() => setSelectedProduct(p.productName)}
                    className={`cursor-pointer transition-colors ${
                      activeProd?.productName === p.productName ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2 font-mono text-slate-400 tabular-nums">{p.rank}</td>
                    <td className="py-2 font-medium text-slate-900">{p.productName}</td>
                    <td className="py-2 text-slate-600">{p.category}</td>
                    <td className="py-2">
                      <span
                        className={`font-medium ${
                          p.velocityTier === 'Fast-Moving'
                            ? 'text-emerald-700'
                            : p.velocityTier === 'Slow-Moving'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                        }`}
                      >
                        {p.velocityTier}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {p.totalQuantity.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-600">
                      {p.basketPenetrationPct}%
                    </td>
                    {capabilities.hasRevenue && (
                      <td className="py-2 text-right font-mono tabular-nums font-medium text-slate-900">
                        {fmtMoney(p.totalRevenue)}
                      </td>
                    )}
                    {capabilities.hasReorder && (
                      <td className="py-2 text-right font-mono tabular-nums text-teal-700">
                        {p.reorderRatePct !== null ? `${p.reorderRatePct}%` : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Product-Level Drill-Down */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          {activeProd ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-500">
                  {activeProd.category} · {activeProd.subcategory} · Rank #{activeProd.rank}
                </div>
                <h3 className="text-base font-semibold text-slate-900 mt-0.5 font-display">
                  {activeProd.productName}
                </h3>
                <div className="mt-1 text-xs text-slate-500">
                  Tags: {activeProd.tags.join(' · ')}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Units Sold</div>
                  <div className="mt-0.5 text-base font-mono font-semibold text-slate-900">
                    {activeProd.totalQuantity.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Basket Penetration</div>
                  <div className="mt-0.5 text-base font-mono font-semibold text-slate-900">
                    {activeProd.basketPenetrationPct}%
                  </div>
                </div>
                {capabilities.hasRevenue && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">Total Revenue</div>
                    <div className="mt-0.5 text-base font-mono font-semibold text-teal-700">
                      {fmtMoney(activeProd.totalRevenue)}
                    </div>
                  </div>
                )}
                {activeProd.avgUnitPrice !== null && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">Avg Unit Price</div>
                    <div className="mt-0.5 text-base font-mono font-semibold text-slate-900">
                      {fmtMoney(activeProd.avgUnitPrice)}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-medium text-slate-700 mb-1">
                  {capabilities.hasDate ? 'Monthly Product Performance' : 'Day-of-Week Unit Demand'}
                </div>
                <PlotlyChart
                  height={190}
                  data={[
                    {
                      x: drillDownSeries.labels,
                      y: drillDownSeries.values,
                      type: capabilities.hasDate ? 'scatter' : 'bar',
                      mode: 'lines+markers',
                      line: { color: '#0d9488', width: 2 },
                      marker: { color: '#0d9488', size: 5 },
                    },
                  ]}
                  layout={{
                    margin: { l: 42, r: 12, t: 10, b: 36 },
                    xaxis: { tickfont: { size: 10 } },
                    yaxis: { gridcolor: '#f1f5f9', tickfont: { size: 10 } },
                  }}
                />
              </div>

              <div>
                <div className="text-xs font-medium text-slate-700 mb-1.5">
                  Top Co-Purchased Partners (Market Basket Rules)
                </div>
                {linkedRules.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No association rules exceed current thresholds for this SKU.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {linkedRules.map((r) => (
                      <div
                        key={r.id}
                        className="px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-slate-800 truncate">{r.consequentLabel}</span>
                        <span className="font-mono text-[11px] text-teal-700 shrink-0 ml-2">
                          Lift {r.lift.toFixed(2)}x · {(r.confidence * 100).toFixed(0)}% conf
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Select a product row to inspect details.</p>
          )}
        </div>
      </section>
    </div>
  );
};
