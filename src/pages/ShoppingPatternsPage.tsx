import React, { useState } from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import { KpiCard } from '../components/KpiCard';
import { PlotlyChart } from '../components/PlotlyChart';

export const ShoppingPatternsPage: React.FC = () => {
  const { activeDataset, capabilities, shoppingPatterns } = useAnalytics();
  const curr = activeDataset.currencySymbol;
  const [heatmapMetric, setHeatmapMetric] = useState<'orders' | 'revenue'>('orders');

  const peakDay = [...shoppingPatterns.byDay].sort((a, b) => b.orders - a.orders)[0];
  const peakHour = [...shoppingPatterns.byHour].sort((a, b) => b.orders - a.orders)[0];
  const wv = shoppingPatterns.weekdayVsWeekend;

  const useRevHeatmap = heatmapMetric === 'revenue' && capabilities.hasRevenue;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Peak Shopping Day"
          value={peakDay?.dayName || 'N/A'}
          subtext={`${peakDay?.orders.toLocaleString() || 0} orders`}
        />
        <KpiCard
          label="Peak Shopping Hour"
          value={capabilities.hasHour ? peakHour?.label || 'N/A' : 'Unavailable'}
          subtext={capabilities.hasHour ? `${peakHour?.orders.toLocaleString() || 0} orders` : 'No hour column'}
          unavailable={!capabilities.hasHour}
        />
        <KpiCard
          label="Weekday Orders"
          value={wv.weekdayOrders.toLocaleString()}
          subtext={`Avg ${wv.weekdayAvgSize} items/basket`}
        />
        <KpiCard
          label="Weekend Orders"
          value={wv.weekendOrders.toLocaleString()}
          subtext={`Avg ${wv.weekendAvgSize} items/basket`}
        />
      </section>

      {/* Day-wise and Hour-wise Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Day-of-Week Order Distribution (Weekday vs Weekend)
          </h3>
          <p className="text-xs text-slate-500">
            Teal bars highlight Saturday &amp; Sunday; dark slate highlights weekdays
          </p>
          <PlotlyChart
            height={300}
            data={[
              {
                x: shoppingPatterns.byDay.map((d) => d.dayName),
                y: shoppingPatterns.byDay.map((d) => d.orders),
                type: 'bar',
                marker: {
                  color: shoppingPatterns.byDay.map((d) => (d.isWeekend ? '#0d9488' : '#334155')),
                },
              },
            ]}
            layout={{
              margin: { l: 50, r: 20, t: 18, b: 44 },
              xaxis: { title: 'Day of Week' },
              yaxis: { title: 'Orders', gridcolor: '#f1f5f9' },
            }}
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Hourly Shopping Curve (00:00 – 23:00)
          </h3>
          <p className="text-xs text-slate-500">
            {capabilities.hasHour
              ? 'Identifying peak grocery storefront traffic windows'
              : 'Hour-of-day timestamps not present in this dataset'}
          </p>
          {capabilities.hasHour ? (
            <PlotlyChart
              height={300}
              data={[
                {
                  x: shoppingPatterns.byHour.map((h) => h.label),
                  y: shoppingPatterns.byHour.map((h) => h.orders),
                  type: 'scatter',
                  mode: 'lines+markers',
                  fill: 'tozeroy',
                  fillcolor: 'rgba(13, 148, 136, 0.12)',
                  line: { color: '#0d9488', width: 2.5 },
                  marker: { size: 5, color: '#0f766e' },
                },
              ]}
              layout={{
                margin: { l: 50, r: 20, t: 18, b: 48 },
                xaxis: { title: 'Hour of Day', tickangle: -35 },
                yaxis: { title: 'Orders', gridcolor: '#f1f5f9' },
              }}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-xs text-slate-500">
              Hourly breakdown unavailable without time/hour column.
            </div>
          )}
        </div>
      </section>

      {/* Day x Hour Heatmap */}
      {capabilities.hasHour && (
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Shopping Day × Hour Intensity Heatmap
              </h3>
              <p className="text-xs text-slate-500">
                When do customers shop most actively across the weekly 7 × 24 grid?
              </p>
            </div>
            {capabilities.hasRevenue && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setHeatmapMetric('orders')}
                  className={`px-3 py-1 rounded-md font-medium ${
                    heatmapMetric === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Order Count
                </button>
                <button
                  type="button"
                  onClick={() => setHeatmapMetric('revenue')}
                  className={`px-3 py-1 rounded-md font-medium ${
                    heatmapMetric === 'revenue' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Revenue ({curr})
                </button>
              </div>
            )}
          </div>

          <PlotlyChart
            height={360}
            data={[
              {
                z: useRevHeatmap
                  ? shoppingPatterns.heatmapMatrix.zRevenue
                  : shoppingPatterns.heatmapMatrix.zOrders,
                x: shoppingPatterns.heatmapMatrix.hours.map((h) => `${String(h).padStart(2, '0')}:00`),
                y: shoppingPatterns.heatmapMatrix.days,
                type: 'heatmap',
                colorscale: [
                  [0, '#f8fafc'],
                  [0.25, '#ccfbf1'],
                  [0.55, '#14b8a6'],
                  [0.85, '#0f766e'],
                  [1, '#0f172a'],
                ],
                hoverongaps: false,
              },
            ]}
            layout={{
              margin: { l: 90, r: 20, t: 16, b: 50 },
              xaxis: { title: 'Hour of Day' },
              yaxis: { automargin: true },
            }}
          />
        </section>
      )}
    </div>
  );
};
