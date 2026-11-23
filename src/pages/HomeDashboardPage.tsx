import React from 'react';
import { ArrowRight, CheckCircle2, Database, Layers, TrendingUp, AlertTriangle, Package, Lightbulb } from 'lucide-react';
import { useAnalytics } from '../context/AnalyticsContext';
import { KpiCard } from '../components/KpiCard';
import { PlotlyChart } from '../components/PlotlyChart';
import { PageId } from '../types/analytics';

export const HomeDashboardPage: React.FC = () => {
  const {
    datasets,
    activeDataset,
    selectDataset,
    capabilities,
    qualityReport,
    basketAnalytics,
    categoryAnalytics,
    productAnalytics,
    customerRFM,
    salesWeekly,
    shoppingPatterns,
    businessInsights,
    setActivePage,
    setSelectedProduct,
    setSelectedCategory,
  } = useAnalytics();

  const curr = activeDataset.currencySymbol;
  const fmtMoney = (v: number | null) =>
    v === null ? 'Unavailable' : `${curr}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const topCategories = categoryAnalytics.slice(0, 7);
  const topProducts = productAnalytics.slice(0, 7);

  const pillarIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    'Business Insights': TrendingUp,
    'Retail Recommendations': Lightbulb,
    'Forecasted Trends': Layers,
    'Anomaly Alerts': AlertTriangle,
    'Inventory Suggestions': Package,
  };

  return (
    <div className="space-y-6">
      {/* Executive Context & Architecture Pipeline Strip */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-xs font-medium text-teal-700">
              SmartGrocery Retail Intelligence Platform
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900 font-display">
              {activeDataset.name}
            </h2>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              {activeDataset.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {datasets.map((ds) => (
              <button
                key={ds.id}
                type="button"
                onClick={() => selectDataset(ds.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  ds.id === activeDataset.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {ds.name}
              </button>
            ))}
          </div>
        </div>

        {/* Pipeline Flow Strip matching System Architecture Diagram */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          {[
            { label: '1. Data Source', val: `${qualityReport.totalRawRows.toLocaleString()} raw rows`, page: 'datasets' as PageId },
            { label: '2. Module 1: Preprocessing', val: `Quality ${qualityReport.qualityScoreBefore}% -> ${qualityReport.qualityScoreAfter}%`, page: 'preprocessing' as PageId },
            { label: '3. Module 2: Baskets', val: `${basketAnalytics.totalBaskets.toLocaleString()} baskets`, page: 'baskets' as PageId },
            { label: '4. Module 3: Associations', val: `${categoryAnalytics.length} categories mapped`, page: 'market-basket' as PageId },
            { label: '5. Decision Intelligence', val: `${businessInsights.length} active signals`, page: 'recommendations' as PageId },
          ].map((step) => (
            <button
              key={step.label}
              type="button"
              onClick={() => setActivePage(step.page)}
              className="text-left p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors"
            >
              <div className="font-medium text-slate-800 truncate">{step.label}</div>
              <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500 truncate">
                {step.val}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Total Transactions"
          value={basketAnalytics.totalBaskets.toLocaleString()}
          subtext={`${basketAnalytics.totalItemsSold.toLocaleString()} items`}
          onClick={() => setActivePage('baskets')}
        />
        <KpiCard
          label="Total Products"
          value={productAnalytics.length.toLocaleString()}
          subtext={`${categoryAnalytics.length} categories`}
          onClick={() => setActivePage('products')}
        />
        <KpiCard
          label="Total Customers"
          value={capabilities.hasCustomerId ? customerRFM.length.toLocaleString() : 'Unavailable'}
          subtext={capabilities.hasCustomerId ? 'Unique active IDs' : 'No customer column'}
          unavailable={!capabilities.hasCustomerId}
          onClick={() => setActivePage('customers')}
        />
        <KpiCard
          label="Total Revenue"
          value={capabilities.hasRevenue ? fmtMoney(basketAnalytics.totalRevenue) : 'Unavailable'}
          subtext={capabilities.hasRevenue ? 'Cleaned line totals' : 'No unit price column'}
          unavailable={!capabilities.hasRevenue}
          onClick={() => setActivePage('sales')}
        />
        <KpiCard
          label="Avg Basket Value"
          value={capabilities.hasRevenue ? fmtMoney(basketAnalytics.avgBasketValue) : 'Unavailable'}
          subtext={
            capabilities.hasRevenue
              ? `Median ${fmtMoney(basketAnalytics.medianBasketValue)}`
              : 'Monetary data absent'
          }
          unavailable={!capabilities.hasRevenue}
          onClick={() => setActivePage('baskets')}
        />
        <KpiCard
          label="Avg Basket Size"
          value={`${basketAnalytics.avgBasketSize} items`}
          subtext={`Median ${basketAnalytics.medianBasketSize} · Max ${basketAnalytics.maxBasketSize}`}
          onClick={() => setActivePage('baskets')}
        />
      </section>

      {/* Main Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {capabilities.hasDate ? 'Weekly Sales & Order Trend' : 'Shopping Activity by Day of Week'}
              </h3>
              <p className="text-xs text-slate-500">
                {capabilities.hasDate
                  ? 'Weekly trajectory of revenue and basket volume across cleaned transactions'
                  : 'Instacart has no calendar dates; displaying order & item volume by day of week'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage(capabilities.hasDate ? 'sales' : 'patterns')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Explore <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {capabilities.hasDate && salesWeekly.length > 0 ? (
            <PlotlyChart
              height={300}
              data={[
                {
                  x: salesWeekly.map((s) => s.period),
                  y: salesWeekly.map((s) => (capabilities.hasRevenue ? s.revenue : s.quantity)),
                  type: 'scatter',
                  mode: 'lines+markers',
                  name: capabilities.hasRevenue ? 'Weekly Revenue' : 'Weekly Units',
                  line: { color: '#0d9488', width: 2.5 },
                  marker: { size: 5, color: '#0f766e' },
                  fill: 'tozeroy',
                  fillcolor: 'rgba(13, 148, 136, 0.08)',
                },
              ]}
              layout={{
                margin: { l: 55, r: 20, t: 16, b: 42 },
                xaxis: { title: 'Week Starting', gridcolor: '#f1f5f9' },
                yaxis: {
                  title: capabilities.hasRevenue ? `Revenue (${curr})` : 'Units Sold',
                  gridcolor: '#f1f5f9',
                },
              }}
            />
          ) : (
            <PlotlyChart
              height={300}
              data={[
                {
                  x: shoppingPatterns.byDay.map((d) => d.dayName),
                  y: shoppingPatterns.byDay.map((d) => d.orders),
                  type: 'bar',
                  name: 'Orders',
                  marker: {
                    color: shoppingPatterns.byDay.map((d) => (d.isWeekend ? '#0d9488' : '#334155')),
                  },
                },
              ]}
              layout={{
                margin: { l: 52, r: 20, t: 16, b: 42 },
                xaxis: { title: 'Day of Week' },
                yaxis: { title: 'Orders', gridcolor: '#f1f5f9' },
              }}
            />
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Category Contribution</h3>
              <p className="text-xs text-slate-500">
                {capabilities.hasRevenue ? 'Top categories by revenue share' : 'Top categories by units sold'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('categories')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Treemap <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <PlotlyChart
            height={300}
            data={[
              {
                y: [...topCategories].reverse().map((c) => c.category),
                x: [...topCategories]
                  .reverse()
                  .map((c) => (capabilities.hasRevenue ? (c.revenue ?? 0) : c.quantity)),
                type: 'bar',
                orientation: 'h',
                marker: { color: '#0f766e' },
              },
            ]}
            layout={{
              margin: { l: 135, r: 20, t: 16, b: 40 },
              xaxis: {
                title: capabilities.hasRevenue ? `Revenue (${curr})` : 'Units Sold',
                gridcolor: '#f1f5f9',
              },
              yaxis: { automargin: true },
            }}
            onPointClick={(ev) => {
              const cat = ev?.points?.[0]?.y;
              if (cat) {
                setSelectedCategory(String(cat));
                setActivePage('categories');
              }
            }}
          />
        </div>
      </section>

      {/* Decision Intelligence Layer (5 Major Pillars from Architecture Diagram) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Decision Intelligence Layer
            </h3>
            <p className="text-xs text-slate-500">
              Live automated signals synthesized from Module 1, Module 2, and Module 3 computations
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('ask-data')}
            className="px-3 py-1.5 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            Ask the Data
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {businessInsights.map((insight) => {
            const Icon = pillarIcons[insight.pillar] || CheckCircle2;
            const toneText =
              insight.severity === 'positive'
                ? 'text-emerald-700'
                : insight.severity === 'alert'
                  ? 'text-rose-700'
                  : insight.severity === 'warning'
                    ? 'text-amber-700'
                    : 'text-slate-600';

            return (
              <button
                key={insight.id}
                type="button"
                onClick={() => setActivePage(insight.targetPage)}
                className="text-left p-4 rounded-xl border border-slate-200 hover:border-teal-500 bg-slate-50/40 hover:bg-white transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <Icon className="w-3.5 h-3.5 text-teal-700" />
                      {insight.pillar}
                    </span>
                    <span className={`text-xs font-mono font-medium tabular-nums ${toneText}`}>
                      {insight.metricValue}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{insight.title}</div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{insight.summary}</p>
                </div>
                <div className="mt-3 text-xs font-medium text-teal-700 inline-flex items-center gap-1">
                  Inspect module <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Top Products & Quick Module Shortcuts */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Top Performing Products</h3>
              <p className="text-xs text-slate-500">Click any product to open its SKU drill-down</p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('products')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
            >
              All Products <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">#</th>
                  <th className="py-2 text-left font-medium">Product</th>
                  <th className="py-2 text-left font-medium">Category</th>
                  <th className="py-2 text-right font-medium">Baskets</th>
                  <th className="py-2 text-right font-medium">Units</th>
                  {capabilities.hasRevenue && <th className="py-2 text-right font-medium">Revenue</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.map((p) => (
                  <tr
                    key={p.productName}
                    onClick={() => {
                      setSelectedProduct(p.productName);
                      setActivePage('products');
                    }}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 font-mono text-slate-400 tabular-nums">{p.rank}</td>
                    <td className="py-2.5 font-medium text-slate-900">{p.productName}</td>
                    <td className="py-2.5 text-slate-600">{p.category}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {p.transactionCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {p.totalQuantity.toLocaleString()}
                    </td>
                    {capabilities.hasRevenue && (
                      <td className="py-2.5 text-right font-mono tabular-nums font-medium text-slate-900">
                        {fmtMoney(p.totalRevenue)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">Quick Module Navigation</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Jump directly into any analytical workspace
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {[
              { page: 'datasets' as PageId, title: 'Upload CSV / Excel', desc: 'Dataset Management' },
              { page: 'quality' as PageId, title: 'Data Quality Report', desc: `Score ${qualityReport.qualityScoreAfter}%` },
              { page: 'baskets' as PageId, title: 'Histogram & Violin', desc: 'Basket Distributions' },
              { page: 'network' as PageId, title: 'Association Network', desc: 'Interactive Graph' },
              { page: 'forecasting' as PageId, title: 'Sales Forecasting', desc: capabilities.hasDate ? 'Holt & OLS Models' : 'Requires Dates' },
              { page: 'simulator' as PageId, title: 'What-If Simulator', desc: 'Promo Elasticity' },
              { page: 'anomalies' as PageId, title: 'Anomaly Detection', desc: 'Spike & Drop Scan' },
              { page: 'reports' as PageId, title: 'Export Reports', desc: 'CSV & Markdown' },
            ].map((item) => (
              <button
                key={item.page}
                type="button"
                onClick={() => setActivePage(item.page)}
                className="text-left p-3 rounded-lg border border-slate-200 hover:border-teal-500 hover:bg-slate-50 transition-colors"
              >
                <div className="font-medium text-slate-900 flex items-center justify-between">
                  <span>{item.title}</span>
                  <Database className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
