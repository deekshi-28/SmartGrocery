import React, { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAnalytics } from '../context/AnalyticsContext';
import { PlotlyChart } from '../components/PlotlyChart';
import { KpiCard } from '../components/KpiCard';

export const CategoryAnalyticsPage: React.FC = () => {
  const {
    activeDataset,
    capabilities,
    categoryAnalytics,
    productAnalytics,
    selectedCategory,
    setSelectedCategory,
    setSelectedProduct,
    setActivePage,
  } = useAnalytics();

  const curr = activeDataset.currencySymbol;
  const fmtMoney = (v: number | null) =>
    v === null ? 'N/A' : `${curr}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const activeCategory = useMemo(
    () =>
      categoryAnalytics.find((c) => c.category === selectedCategory) ||
      categoryAnalytics[0] ||
      null,
    [categoryAnalytics, selectedCategory]
  );

  // Build hierarchical Treemap arrays (Root -> Categories -> Subcategories)
  const treemapData = useMemo(() => {
    const labels: string[] = ['All Categories'];
    const parents: string[] = [''];
    const values: number[] = [0];

    let rootSum = 0;
    for (const cat of categoryAnalytics) {
      const catVal = capabilities.hasRevenue ? (cat.revenue ?? 0) : cat.quantity;
      rootSum += catVal;
      labels.push(cat.category);
      parents.push('All Categories');
      values.push(catVal);

      for (const sub of cat.subcategories) {
        const subVal = capabilities.hasRevenue ? (sub.revenue ?? 0) : sub.quantity;
        if (subVal <= 0) continue;
        labels.push(`${sub.name} (${cat.category})`);
        parents.push(cat.category);
        values.push(subVal);
      }
    }
    values[0] = rootSum;
    return { labels, parents, values };
  }, [categoryAnalytics, capabilities.hasRevenue]);

  const categoryProducts = useMemo(() => {
    if (!activeCategory) return [];
    return productAnalytics.filter((p) => p.category === activeCategory.category);
  }, [productAnalytics, activeCategory]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Categories"
          value={categoryAnalytics.length.toString()}
          subtext="Standardized taxonomy groups"
        />
        <KpiCard
          label="Top Category"
          value={categoryAnalytics[0]?.category || 'N/A'}
          subtext={
            capabilities.hasRevenue
              ? `${categoryAnalytics[0]?.revenueSharePct ?? 0}% of total revenue`
              : `${categoryAnalytics[0]?.quantitySharePct ?? 0}% of total units`
          }
        />
        <KpiCard
          label="Fastest Growing Category"
          value={
            capabilities.hasDate
              ? [...categoryAnalytics]
                  .filter((c) => c.growthPct !== null)
                  .sort((a, b) => (b.growthPct ?? -999) - (a.growthPct ?? -999))[0]?.category || 'N/A'
              : 'Requires Dates'
          }
          subtext={
            capabilities.hasDate
              ? `${
                  [...categoryAnalytics]
                    .filter((c) => c.growthPct !== null)
                    .sort((a, b) => (b.growthPct ?? -999) - (a.growthPct ?? -999))[0]?.growthPct ?? 0
                }% period growth`
              : 'Period growth unavailable'
          }
          unavailable={!capabilities.hasDate}
        />
        <KpiCard
          label="Selected Drill-Down"
          value={activeCategory?.category || 'None'}
          subtext={activeCategory ? `${activeCategory.uniqueProducts} SKUs mapped` : ''}
        />
      </section>

      {/* Interactive Treemap & Comparison Bar */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Category &amp; Subcategory Proportions (Interactive Treemap)
          </h3>
          <p className="text-xs text-slate-500">
            Which categories and subcategories contribute the most {capabilities.hasRevenue ? 'revenue' : 'unit volume'}? Click tiles to zoom or drill down.
          </p>
          <PlotlyChart
            height={380}
            data={[
              {
                type: 'treemap',
                labels: treemapData.labels,
                parents: treemapData.parents,
                values: treemapData.values,
                branchvalues: 'total',
                textinfo: 'label+percent parent',
                marker: {
                  colorscale: [
                    [0, '#f1f5f9'],
                    [0.35, '#99f6e4'],
                    [0.7, '#0d9488'],
                    [1, '#0f172a'],
                  ],
                },
              },
            ]}
            layout={{
              margin: { l: 8, r: 8, t: 16, b: 8 },
            }}
            onPointClick={(ev) => {
              const label = ev?.points?.[0]?.label;
              if (label && categoryAnalytics.some((c) => c.category === label)) {
                setSelectedCategory(label);
              }
            }}
          />
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Category Share Comparison
          </h3>
          <p className="text-xs text-slate-500">
            Comparing basket volume vs {capabilities.hasRevenue ? 'revenue share (%)' : 'unit share (%)'}
          </p>
          <PlotlyChart
            height={380}
            data={[
              {
                y: [...categoryAnalytics].reverse().map((c) => c.category),
                x: [...categoryAnalytics].reverse().map((c) => c.quantitySharePct),
                type: 'bar',
                orientation: 'h',
                name: 'Unit Share (%)',
                marker: { color: '#334155' },
              },
              ...(capabilities.hasRevenue
                ? [
                    {
                      y: [...categoryAnalytics].reverse().map((c) => c.category),
                      x: [...categoryAnalytics].reverse().map((c) => c.revenueSharePct ?? 0),
                      type: 'bar',
                      orientation: 'h',
                      name: 'Revenue Share (%)',
                      marker: { color: '#0d9488' },
                    },
                  ]
                : []),
            ]}
            layout={{
              barmode: 'group',
              margin: { l: 135, r: 20, t: 16, b: 45 },
              xaxis: { title: 'Contribution (%)', gridcolor: '#f1f5f9' },
              yaxis: { automargin: true },
              legend: { orientation: 'h', y: -0.18 },
            }}
          />
        </div>
      </section>

      {/* Category Ranking Table & Drill-Down */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Category Performance Ranking (Click row to drill down)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">Category</th>
                  <th className="py-2 text-right font-medium">SKUs</th>
                  <th className="py-2 text-right font-medium">Baskets</th>
                  <th className="py-2 text-right font-medium">Units</th>
                  <th className="py-2 text-right font-medium">Unit Share</th>
                  {capabilities.hasRevenue && <th className="py-2 text-right font-medium">Revenue</th>}
                  {capabilities.hasRevenue && <th className="py-2 text-right font-medium">Rev Share</th>}
                  {capabilities.hasDate && <th className="py-2 text-right font-medium">Growth</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoryAnalytics.map((cat) => (
                  <tr
                    key={cat.category}
                    onClick={() => setSelectedCategory(cat.category)}
                    className={`cursor-pointer transition-colors ${
                      activeCategory?.category === cat.category ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 font-medium text-slate-900">{cat.category}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-600">
                      {cat.uniqueProducts}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {cat.transactionCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {cat.quantity.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-600">
                      {cat.quantitySharePct}%
                    </td>
                    {capabilities.hasRevenue && (
                      <td className="py-2.5 text-right font-mono tabular-nums font-medium text-slate-900">
                        {fmtMoney(cat.revenue)}
                      </td>
                    )}
                    {capabilities.hasRevenue && (
                      <td className="py-2.5 text-right font-mono tabular-nums text-teal-700">
                        {cat.revenueSharePct}%
                      </td>
                    )}
                    {capabilities.hasDate && (
                      <td
                        className={`py-2.5 text-right font-mono tabular-nums font-medium ${
                          (cat.growthPct ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {cat.growthPct !== null ? `${cat.growthPct >= 0 ? '+' : ''}${cat.growthPct}%` : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          {activeCategory ? (
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Drill-Down: {activeCategory.category}
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  {activeCategory.subcategories.length} subcategories
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {activeCategory.subcategories.map((sub) => (
                  <div
                    key={sub.name}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-medium text-slate-800">{sub.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {sub.transactions} baskets · {sub.quantity} units
                      </div>
                    </div>
                    {capabilities.hasRevenue && (
                      <div className="font-mono font-semibold text-slate-900">
                        {fmtMoney(sub.revenue)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="text-xs font-medium text-slate-700 mb-2">
                  Top Products in {activeCategory.category}
                </div>
                <div className="space-y-1.5">
                  {categoryProducts.slice(0, 6).map((p) => (
                    <button
                      key={p.productName}
                      type="button"
                      onClick={() => {
                        setSelectedProduct(p.productName);
                        setActivePage('products');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-100 flex items-center justify-between text-xs transition-colors"
                    >
                      <span className="text-slate-800 font-medium truncate">{p.productName}</span>
                      <span className="inline-flex items-center gap-1 text-teal-700 font-mono shrink-0">
                        {capabilities.hasRevenue ? fmtMoney(p.totalRevenue) : `${p.totalQuantity} units`}
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">No category selected.</p>
          )}
        </div>
      </section>
    </div>
  );
};
