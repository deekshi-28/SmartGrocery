import React, { useMemo, useState } from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import { KpiCard } from '../components/KpiCard';
import { PlotlyChart } from '../components/PlotlyChart';

export const BasketAnalyticsPage: React.FC = () => {
  const { activeDataset, capabilities, basketAnalytics } = useAnalytics();
  const curr = activeDataset.currencySymbol;
  const fmtMoney = (v: number | null) =>
    v === null ? 'Unavailable' : `${curr}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [minItemsFilter, setMinItemsFilter] = useState<number>(1);
  const [daySegment, setDaySegment] = useState<'all' | 'weekday' | 'weekend'>('all');
  const [selectedBasketId, setSelectedBasketId] = useState<string | null>(null);

  const filteredBaskets = useMemo(() => {
    return basketAnalytics.baskets.filter((b) => {
      if (b.itemCount < minItemsFilter) return false;
      if (daySegment === 'weekend' && b.isWeekend !== true) return false;
      if (daySegment === 'weekday' && b.isWeekend !== false) return false;
      return true;
    });
  }, [basketAnalytics.baskets, minItemsFilter, daySegment]);

  const weekdayBaskets = useMemo(
    () => filteredBaskets.filter((b) => b.isWeekend === false),
    [filteredBaskets]
  );
  const weekendBaskets = useMemo(
    () => filteredBaskets.filter((b) => b.isWeekend === true),
    [filteredBaskets]
  );

  const inspectedBasket = useMemo(
    () => filteredBaskets.find((b) => b.transactionId === selectedBasketId) || filteredBaskets[0] || null,
    [filteredBaskets, selectedBasketId]
  );

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Total Baskets"
          value={basketAnalytics.totalBaskets.toLocaleString()}
          subtext={`${basketAnalytics.totalItemsSold.toLocaleString()} total items`}
        />
        <KpiCard
          label="Avg Basket Value"
          value={capabilities.hasRevenue ? fmtMoney(basketAnalytics.avgBasketValue) : 'Unavailable'}
          subtext={capabilities.hasRevenue ? `Std dev ${fmtMoney(basketAnalytics.stdBasketValue)}` : 'No price data'}
          unavailable={!capabilities.hasRevenue}
        />
        <KpiCard
          label="Median Basket Value"
          value={capabilities.hasRevenue ? fmtMoney(basketAnalytics.medianBasketValue) : 'Unavailable'}
          subtext={
            capabilities.hasRevenue
              ? `Min ${fmtMoney(basketAnalytics.minBasketValue)} · Max ${fmtMoney(basketAnalytics.maxBasketValue)}`
              : 'No price data'
          }
          unavailable={!capabilities.hasRevenue}
        />
        <KpiCard
          label="Avg Basket Size"
          value={`${basketAnalytics.avgBasketSize} items`}
          subtext="Quantity per order"
        />
        <KpiCard
          label="Median Basket Size"
          value={`${basketAnalytics.medianBasketSize} items`}
          subtext={`Min ${basketAnalytics.minBasketSize} · Max ${basketAnalytics.maxBasketSize}`}
        />
        <KpiCard
          label="Filtered Baskets"
          value={filteredBaskets.length.toLocaleString()}
          subtext="Matching local controls"
        />
      </section>

      {/* Interactive Local Filters */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="min-items-range" className="font-medium text-slate-700">
              Minimum Basket Size: <span className="font-mono text-teal-700">{minItemsFilter}+ items</span>
            </label>
            <input
              id="min-items-range"
              type="range"
              min={1}
              max={Math.max(5, Math.min(15, basketAnalytics.maxBasketSize))}
              value={minItemsFilter}
              onChange={(e) => setMinItemsFilter(Number(e.target.value))}
              className="accent-teal-700"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'all' as const, label: 'All Days' },
              { id: 'weekday' as const, label: 'Weekdays' },
              { id: 'weekend' as const, label: 'Weekends' },
            ].map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => setDaySegment(seg.id)}
                className={`px-3 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                  daySegment === seg.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>
        </div>

        {!capabilities.hasRevenue && (
          <div className="text-amber-700 font-medium">
            Monetary value charts hidden because "{activeDataset.name}" has no unit price column.
          </div>
        )}
      </section>

      {/* Histogram & Violin Plots for Basket Value (when supported) */}
      {capabilities.hasRevenue && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Basket Value Distribution (Histogram)
            </h3>
            <p className="text-xs text-slate-500">
              What is the distribution of total monetary spend per transaction?
            </p>
            <PlotlyChart
              height={320}
              data={[
                {
                  x: filteredBaskets.map((b) => b.basketValue ?? 0),
                  type: 'histogram',
                  nbinsx: 24,
                  marker: { color: '#0d9488', line: { color: '#ffffff', width: 1 } },
                  name: 'Baskets',
                },
              ]}
              layout={{
                margin: { l: 52, r: 20, t: 20, b: 48 },
                xaxis: { title: `Basket Value (${curr})`, gridcolor: '#f1f5f9' },
                yaxis: { title: 'Number of Baskets', gridcolor: '#f1f5f9' },
              }}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Basket Value Comparison: Weekday vs Weekend (Violin Plot)
            </h3>
            <p className="text-xs text-slate-500">
              Density distribution, median, and interquartile range of basket values
            </p>
            <PlotlyChart
              height={320}
              data={[
                {
                  y: weekdayBaskets.map((b) => b.basketValue ?? 0),
                  type: 'violin',
                  name: 'Weekday Baskets',
                  box: { visible: true },
                  meanline: { visible: true },
                  fillcolor: 'rgba(37, 99, 235, 0.22)',
                  line: { color: '#2563eb' },
                },
                {
                  y: weekendBaskets.map((b) => b.basketValue ?? 0),
                  type: 'violin',
                  name: 'Weekend Baskets',
                  box: { visible: true },
                  meanline: { visible: true },
                  fillcolor: 'rgba(13, 148, 136, 0.25)',
                  line: { color: '#0d9488' },
                },
              ]}
              layout={{
                margin: { l: 52, r: 20, t: 20, b: 42 },
                yaxis: { title: `Basket Value (${curr})`, gridcolor: '#f1f5f9' },
                showlegend: true,
                legend: { orientation: 'h', y: -0.18 },
              }}
            />
          </div>
        </section>
      )}

      {/* Histogram & Violin Plots for Basket Size (Items per Basket) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Basket Size Distribution (Items per Basket Histogram)
          </h3>
          <p className="text-xs text-slate-500">
            Frequency of total item quantities purchased per transaction
          </p>
          <PlotlyChart
            height={320}
            data={[
              {
                x: filteredBaskets.map((b) => b.itemCount),
                type: 'histogram',
                xbins: { size: 1 },
                marker: { color: '#334155', line: { color: '#ffffff', width: 1 } },
                name: 'Basket Size',
              },
            ]}
            layout={{
              margin: { l: 52, r: 20, t: 20, b: 48 },
              xaxis: { title: 'Items in Basket', gridcolor: '#f1f5f9' },
              yaxis: { title: 'Order Count', gridcolor: '#f1f5f9' },
            }}
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Basket Size Distribution: Weekday vs Weekend (Violin Plot)
          </h3>
          <p className="text-xs text-slate-500">
            Comparing item-count density across weekday and weekend shopping trips
          </p>
          <PlotlyChart
            height={320}
            data={[
              {
                y: weekdayBaskets.map((b) => b.itemCount),
                type: 'violin',
                name: 'Weekday',
                box: { visible: true },
                meanline: { visible: true },
                fillcolor: 'rgba(71, 85, 105, 0.22)',
                line: { color: '#475569' },
              },
              {
                y: weekendBaskets.map((b) => b.itemCount),
                type: 'violin',
                name: 'Weekend',
                box: { visible: true },
                meanline: { visible: true },
                fillcolor: 'rgba(13, 148, 136, 0.25)',
                line: { color: '#0d9488' },
              },
            ]}
            layout={{
              margin: { l: 52, r: 20, t: 20, b: 42 },
              yaxis: { title: 'Items per Basket', gridcolor: '#f1f5f9' },
              showlegend: true,
              legend: { orientation: 'h', y: -0.18 },
            }}
          />
        </div>
      </section>

      {/* Detailed Basket Inspector */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Detailed Basket Records (Top 25 by {capabilities.hasRevenue ? 'Value' : 'Size'})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">Transaction ID</th>
                  <th className="py-2 text-left font-medium">Customer</th>
                  <th className="py-2 text-left font-medium">Day / Date</th>
                  <th className="py-2 text-right font-medium">Unique SKUs</th>
                  <th className="py-2 text-right font-medium">Total Items</th>
                  {capabilities.hasRevenue && <th className="py-2 text-right font-medium">Basket Value</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...filteredBaskets]
                  .sort((a, b) =>
                    capabilities.hasRevenue
                      ? (b.basketValue ?? 0) - (a.basketValue ?? 0)
                      : b.itemCount - a.itemCount
                  )
                  .slice(0, 25)
                  .map((b) => (
                    <tr
                      key={b.transactionId}
                      onClick={() => setSelectedBasketId(b.transactionId)}
                      className={`cursor-pointer transition-colors ${
                        inspectedBasket?.transactionId === b.transactionId
                          ? 'bg-teal-50/60'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2 font-mono font-medium text-slate-900">{b.transactionId}</td>
                      <td className="py-2 font-mono text-slate-600">{b.customerId ?? 'Guest'}</td>
                      <td className="py-2 text-slate-600">
                        {b.purchaseDate || b.dayOfWeekName || 'N/A'}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                        {b.uniqueProductCount}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                        {b.itemCount}
                      </td>
                      {capabilities.hasRevenue && (
                        <td className="py-2 text-right font-mono tabular-nums font-medium text-slate-900">
                          {fmtMoney(b.basketValue)}
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">Basket Contents Inspector</h3>
          {inspectedBasket ? (
            <div className="mt-3 space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-mono font-semibold text-slate-900">
                  Order {inspectedBasket.transactionId}
                </div>
                <div className="text-slate-600">
                  Customer: {inspectedBasket.customerId ?? 'Guest'} · {inspectedBasket.itemCount} items
                </div>
                {capabilities.hasRevenue && (
                  <div className="font-mono font-medium text-teal-700">
                    Total Value: {fmtMoney(inspectedBasket.basketValue)}
                  </div>
                )}
              </div>

              <div>
                <div className="font-medium text-slate-700 mb-1.5">
                  Categories ({inspectedBasket.categories.length})
                </div>
                <div className="text-slate-600 leading-relaxed">
                  {inspectedBasket.categories.join(' · ')}
                </div>
              </div>

              <div>
                <div className="font-medium text-slate-700 mb-1.5">
                  Products in Basket ({inspectedBasket.products.length})
                </div>
                <ul className="space-y-1 max-h-60 overflow-y-auto">
                  {inspectedBasket.products.map((prod) => (
                    <li key={prod} className="py-1 border-b border-slate-100 text-slate-700">
                      {prod}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Select a basket row to inspect its contents.</p>
          )}
        </div>
      </section>
    </div>
  );
};
