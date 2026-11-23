import React, { useMemo, useState } from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import { EmptyOrUnsupportedState } from '../components/EmptyOrUnsupportedState';
import { KpiCard } from '../components/KpiCard';
import { PlotlyChart } from '../components/PlotlyChart';

export const SalesAnalyticsPage: React.FC = () => {
  const {
    activeDataset,
    capabilities,
    salesDaily,
    salesWeekly,
    salesMonthly,
    cleanedTransactions,
    correlogram,
  } = useAnalytics();

  const curr = activeDataset.currencySymbol;
  const fmtMoney = (v: number | null) =>
    v === null ? 'N/A' : `${curr}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [selectedCatCompare, setSelectedCatCompare] = useState<string>('ALL');

  // Category-level monthly trend
  const categoryTrends = useMemo(() => {
    if (!capabilities.hasDate) return [];
    const topCats = Array.from(
      cleanedTransactions.reduce((m, t) => {
        m.set(t.category, (m.get(t.category) ?? 0) + (capabilities.hasRevenue ? (t.revenue ?? 0) : t.quantity));
        return m;
      }, new Map<string, number>())
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => c);

    const months = Array.from(
      new Set(cleanedTransactions.map((t) => t.purchaseDate?.slice(0, 7)).filter((x): x is string => Boolean(x)))
    ).sort();

    return topCats
      .filter((c) => selectedCatCompare === 'ALL' || selectedCatCompare === c)
      .map((cat) => {
        const vals = months.map((m) =>
          cleanedTransactions
            .filter((t) => t.category === cat && t.purchaseDate?.startsWith(m))
            .reduce((s, t) => s + (capabilities.hasRevenue ? (t.revenue ?? 0) : t.quantity), 0)
        );
        return { category: cat, months, values: vals.map((v) => Number(v.toFixed(2))) };
      });
  }, [cleanedTransactions, capabilities.hasDate, capabilities.hasRevenue, selectedCatCompare]);

  if (!capabilities.hasDate) {
    return (
      <div className="space-y-6">
        <EmptyOrUnsupportedState
          title="Time-Series Sales Trends Unavailable"
          description={`"${activeDataset.name}" does not contain calendar purchase dates. Without calendar timestamps, daily, weekly, and monthly sales trends cannot be plotted without inventing dates.`}
          suggestionLabel="Inspect Shopping Patterns Instead"
          targetPage="patterns"
        />

        {/* Category-Sales Correlogram still works across baskets! */}
        {correlogram.categories.length >= 2 && (
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Category Co-Occurrence Correlogram (Basket-Level Pearson r)
            </h3>
            <p className="text-xs text-slate-500">
              Positive values indicate categories purchased together in the same baskets; negative values indicate substitution or separate missions.
            </p>
            <PlotlyChart
              height={380}
              data={[
                {
                  z: correlogram.matrix,
                  x: correlogram.categories,
                  y: correlogram.categories,
                  type: 'heatmap',
                  zmin: -1,
                  zmax: 1,
                  colorscale: [
                    [0, '#dc2626'],
                    [0.5, '#f8fafc'],
                    [1, '#0d9488'],
                  ],
                  text: correlogram.matrix.map((row) => row.map((v) => v.toFixed(2))),
                  texttemplate: '%{text}',
                },
              ]}
              layout={{
                margin: { l: 135, r: 20, t: 20, b: 95 },
                xaxis: { tickangle: -28 },
                yaxis: { automargin: true },
              }}
            />
          </section>
        )}
      </div>
    );
  }

  const series =
    granularity === 'daily' ? salesDaily : granularity === 'weekly' ? salesWeekly : salesMonthly;

  const peakPeriod = [...series].sort((a, b) =>
    capabilities.hasRevenue ? (b.revenue ?? 0) - (a.revenue ?? 0) : b.quantity - a.quantity
  )[0];

  const latestGrowth =
    series.length > 1 ? series[series.length - 1].growthPct : null;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Time Periods"
          value={series.length.toString()}
          subtext={`${granularity.charAt(0).toUpperCase() + granularity.slice(1)} buckets`}
        />
        <KpiCard
          label="Peak Period"
          value={peakPeriod?.period || 'N/A'}
          subtext={
            capabilities.hasRevenue
              ? fmtMoney(peakPeriod?.revenue ?? null)
              : `${peakPeriod?.quantity ?? 0} units`
          }
        />
        <KpiCard
          label="Latest Period Growth"
          value={latestGrowth !== null ? `${latestGrowth >= 0 ? '+' : ''}${latestGrowth}%` : '—'}
          trendTone={latestGrowth !== null && latestGrowth >= 0 ? 'positive' : 'negative'}
          subtext="Period-over-period change"
        />
        <KpiCard
          label="Strongest Category Pair"
          value={
            correlogram.strongestPositive
              ? `r = ${correlogram.strongestPositive.r.toFixed(2)}`
              : 'N/A'
          }
          subtext={
            correlogram.strongestPositive
              ? `${correlogram.strongestPositive.catA} & ${correlogram.strongestPositive.catB}`
              : ''
          }
        />
      </section>

      {/* Main Sales Trend Chart */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {granularity.charAt(0).toUpperCase() + granularity.slice(1)} Sales &amp; Quantity Trajectory
            </h3>
            <p className="text-xs text-slate-500">
              Interactive time-series of {capabilities.hasRevenue ? 'revenue and unit volume' : 'units and transactions'}
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
            {(['daily', 'weekly', 'monthly'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={`px-3 py-1 rounded-md font-medium capitalize transition-colors ${
                  granularity === g ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <PlotlyChart
          height={340}
          data={[
            ...(capabilities.hasRevenue
              ? [
                  {
                    x: series.map((s) => s.period),
                    y: series.map((s) => s.revenue ?? 0),
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: `Revenue (${curr})`,
                    line: { color: '#0d9488', width: 2.5 },
                    marker: { size: 5, color: '#0f766e' },
                  },
                ]
              : []),
            {
              x: series.map((s) => s.period),
              y: series.map((s) => s.quantity),
              type: 'bar',
              name: 'Units Sold',
              yaxis: capabilities.hasRevenue ? 'y2' : 'y',
              marker: { color: 'rgba(51, 65, 85, 0.25)' },
            },
          ]}
          layout={{
            margin: { l: 55, r: 55, t: 18, b: 48 },
            xaxis: { title: 'Period', gridcolor: '#f1f5f9' },
            yaxis: {
              title: capabilities.hasRevenue ? `Revenue (${curr})` : 'Units Sold',
              gridcolor: '#f1f5f9',
            },
            ...(capabilities.hasRevenue
              ? {
                  yaxis2: {
                    title: 'Units Sold',
                    overlaying: 'y',
                    side: 'right',
                    showgrid: false,
                  },
                }
              : {}),
            legend: { orientation: 'h', y: -0.2 },
          }}
        />
      </section>

      {/* Category Trends & Category-Sales Correlogram */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Category-Level Monthly Trends
              </h3>
              <p className="text-xs text-slate-500">Top 5 categories over calendar months</p>
            </div>
            <select
              aria-label="Filter category trend"
              value={selectedCatCompare}
              onChange={(e) => setSelectedCatCompare(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md"
            >
              <option value="ALL">Top 5 Categories</option>
              {correlogram.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <PlotlyChart
            height={340}
            data={categoryTrends.map((ct) => ({
              x: ct.months,
              y: ct.values,
              type: 'scatter',
              mode: 'lines+markers',
              name: ct.category,
            }))}
            layout={{
              margin: { l: 52, r: 16, t: 16, b: 42 },
              xaxis: { title: 'Month' },
              yaxis: {
                title: capabilities.hasRevenue ? `Revenue (${curr})` : 'Units',
                gridcolor: '#f1f5f9',
              },
              legend: { orientation: 'h', y: -0.22 },
            }}
          />
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Category-Sales Correlogram (Pearson Correlation r)
          </h3>
          <p className="text-xs text-slate-500">
            Which categories show positive co-movement across daily sales?
          </p>
          <PlotlyChart
            height={340}
            data={[
              {
                z: correlogram.matrix,
                x: correlogram.categories,
                y: correlogram.categories,
                type: 'heatmap',
                zmin: -1,
                zmax: 1,
                colorscale: [
                  [0, '#dc2626'],
                  [0.5, '#f8fafc'],
                  [1, '#0d9488'],
                ],
                text: correlogram.matrix.map((row) => row.map((v) => v.toFixed(2))),
                texttemplate: '%{text}',
              },
            ]}
            layout={{
              margin: { l: 125, r: 16, t: 16, b: 85 },
              xaxis: { tickangle: -28 },
              yaxis: { automargin: true },
            }}
          />
        </div>
      </section>
    </div>
  );
};
