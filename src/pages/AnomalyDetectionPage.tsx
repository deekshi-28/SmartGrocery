import React, { useMemo, useState } from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import { EmptyOrUnsupportedState } from '../components/EmptyOrUnsupportedState';
import { KpiCard } from '../components/KpiCard';
import { PlotlyChart } from '../components/PlotlyChart';

export const AnomalyDetectionPage: React.FC = () => {
  const {
    activeDataset,
    capabilities,
    salesDaily,
    anomalies,
    anomalyThreshold,
    setAnomalyThreshold,
  } = useAnalytics();

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Spike' | 'Drop'>('ALL');
  const [metricFilter, setMetricFilter] = useState<'ALL' | 'Revenue' | 'Transaction Volume' | 'Product Demand'>('ALL');

  const curr = activeDataset.currencySymbol;

  if (!capabilities.hasDate) {
    return (
      <EmptyOrUnsupportedState
        title="Time-Series Anomaly Detection Unavailable"
        description={`"${activeDataset.name}" lacks calendar dates. Daily sales spike and drop detection requires chronological timestamps.`}
        suggestionLabel="Review Data Quality Audit Instead"
        targetPage="quality"
      />
    );
  }

  const filteredAnomalies = useMemo(
    () =>
      anomalies.filter((a) => {
        if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
        if (metricFilter !== 'ALL' && a.metric !== metricFilter) return false;
        return true;
      }),
    [anomalies, typeFilter, metricFilter]
  );

  const dailySpikes = anomalies.filter(
    (a) => (a.metric === 'Revenue' || a.metric === 'Transaction Volume') && a.entityName === 'Storewide Daily Sales' && a.type === 'Spike'
  );
  const dailyDrops = anomalies.filter(
    (a) => (a.metric === 'Revenue' || a.metric === 'Transaction Volume') && a.entityName === 'Storewide Daily Sales' && a.type === 'Drop'
  );

  const spikeDates = new Set(dailySpikes.map((a) => a.period));
  const dropDates = new Set(dailyDrops.map((a) => a.period));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Anomalies Flagged"
          value={filteredAnomalies.length.toString()}
          subtext={`Z-score threshold ±${anomalyThreshold.toFixed(1)}σ`}
        />
        <KpiCard
          label="Sales Spikes"
          value={anomalies.filter((a) => a.type === 'Spike').length.toString()}
          trendTone="positive"
          subtext="Demand surges above baseline"
        />
        <KpiCard
          label="Sales Drops"
          value={anomalies.filter((a) => a.type === 'Drop').length.toString()}
          trendTone="negative"
          subtext="Contractions below baseline"
        />
        <KpiCard
          label="Product Demand Outliers"
          value={anomalies.filter((a) => a.metric === 'Product Demand').length.toString()}
          subtext="SKU-level weekly anomalies"
        />
      </section>

      {/* Sensitivity & Filters */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Z-Score Sensitivity:</span>
            <input
              type="range"
              min={1.5}
              max={3.5}
              step={0.1}
              value={anomalyThreshold}
              onChange={(e) => setAnomalyThreshold(Number(e.target.value))}
              className="accent-teal-700"
            />
            <span className="font-mono text-teal-700">±{anomalyThreshold.toFixed(1)}σ</span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'Spike', 'Drop'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-md font-medium ${
                  typeFilter === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter anomaly metric"
            value={metricFilter}
            onChange={(e) => setMetricFilter(e.target.value as typeof metricFilter)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
          >
            <option value="ALL">All Metrics</option>
            <option value="Revenue">Revenue</option>
            <option value="Transaction Volume">Transaction Volume</option>
            <option value="Product Demand">Product Demand</option>
          </select>
        </div>
      </section>

      {/* Visual Anomaly Timeline */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900">
          Daily Sales Timeline with Flagged Statistical Anomalies
        </h3>
        <p className="text-xs text-slate-500">
          Spikes (green triangles) and drops (crimson diamonds) exceeding ±{anomalyThreshold.toFixed(1)}σ from the daily mean
        </p>

        <PlotlyChart
          height={350}
          data={[
            {
              x: salesDaily.map((d) => d.period),
              y: salesDaily.map((d) => (capabilities.hasRevenue ? (d.revenue ?? 0) : d.quantity)),
              type: 'scatter',
              mode: 'lines',
              name: capabilities.hasRevenue ? `Daily Revenue (${curr})` : 'Daily Units',
              line: { color: '#475569', width: 1.8 },
            },
            {
              x: salesDaily.filter((d) => spikeDates.has(d.period)).map((d) => d.period),
              y: salesDaily
                .filter((d) => spikeDates.has(d.period))
                .map((d) => (capabilities.hasRevenue ? (d.revenue ?? 0) : d.quantity)),
              type: 'scatter',
              mode: 'markers',
              name: 'Flagged Spike',
              marker: { color: '#16a34a', size: 11, symbol: 'triangle-up' },
            },
            {
              x: salesDaily.filter((d) => dropDates.has(d.period)).map((d) => d.period),
              y: salesDaily
                .filter((d) => dropDates.has(d.period))
                .map((d) => (capabilities.hasRevenue ? (d.revenue ?? 0) : d.quantity)),
              type: 'scatter',
              mode: 'markers',
              name: 'Flagged Drop',
              marker: { color: '#dc2626', size: 11, symbol: 'diamond' },
            },
          ]}
          layout={{
            margin: { l: 55, r: 20, t: 18, b: 48 },
            xaxis: { title: 'Date', gridcolor: '#f1f5f9' },
            yaxis: {
              title: capabilities.hasRevenue ? `Revenue (${curr})` : 'Units Sold',
              gridcolor: '#f1f5f9',
            },
            legend: { orientation: 'h', y: -0.2 },
          }}
        />
      </section>

      {/* Anomaly Details Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Flagged Anomaly Explanations ({filteredAnomalies.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 text-left font-medium">Period</th>
                <th className="py-2 text-left font-medium">Metric</th>
                <th className="py-2 text-left font-medium">Entity</th>
                <th className="py-2 text-left font-medium">Type</th>
                <th className="py-2 text-right font-medium">Actual</th>
                <th className="py-2 text-right font-medium">Expected</th>
                <th className="py-2 text-right font-medium">Z-Score</th>
                <th className="py-2 text-left font-medium pl-3">Diagnostic Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAnomalies.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="py-2.5 font-mono font-medium text-slate-900">{a.period}</td>
                  <td className="py-2.5 text-slate-700">{a.metric}</td>
                  <td className="py-2.5 font-medium text-slate-900">{a.entityName}</td>
                  <td className="py-2.5">
                    <span
                      className={`font-semibold ${
                        a.type === 'Spike' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {a.type} ({a.severity})
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-slate-900">
                    {a.actualValue.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-slate-500">
                    {a.expectedValue.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-medium text-slate-800">
                    {a.zScore > 0 ? '+' : ''}
                    {a.zScore}σ
                  </td>
                  <td className="py-2.5 pl-3 text-slate-600">{a.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
