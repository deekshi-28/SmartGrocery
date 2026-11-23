import React from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import { EmptyOrUnsupportedState } from '../components/EmptyOrUnsupportedState';
import { KpiCard } from '../components/KpiCard';
import { PlotlyChart } from '../components/PlotlyChart';

export const ForecastingPage: React.FC = () => {
  const {
    activeDataset,
    capabilities,
    forecastConfig,
    setForecastConfig,
    forecastResult,
  } = useAnalytics();

  const curr = activeDataset.currencySymbol;
  const metricLabel = capabilities.hasRevenue ? `Revenue (${curr})` : 'Units Sold';

  if (!forecastResult.supported) {
    return (
      <EmptyOrUnsupportedState
        title="Sales Forecasting Unavailable for This Dataset"
        description={
          forecastResult.unsupportedReason ||
          'Time-series forecasting requires genuine calendar dates. SmartGrocery never generates synthetic forecasts from non-dated datasets.'
        }
        suggestionLabel="Switch to Market Basket Analysis"
        targetPage="market-basket"
      />
    );
  }

  const predPoints = forecastResult.points.filter((p) => p.actual === null && p.forecast !== null);
  const totalProjected = predPoints.reduce((s, p) => s + (p.forecast ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={`Projected ${forecastConfig.horizonPeriods}-${forecastConfig.granularity === 'weekly' ? 'Week' : 'Month'} Total`}
          value={
            capabilities.hasRevenue
              ? `${curr}${totalProjected.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : `${Math.round(totalProjected).toLocaleString()} units`
          }
          subtext="Forecast horizon sum"
        />
        <KpiCard
          label="Model MAPE"
          value={`${forecastResult.mapePct}%`}
          subtext="Mean absolute % error"
        />
        <KpiCard
          label="Model RMSE"
          value={
            capabilities.hasRevenue
              ? `${curr}${forecastResult.rmse.toLocaleString()}`
              : forecastResult.rmse.toLocaleString()
          }
          subtext={`R² = ${forecastResult.rSquared}`}
        />
        <KpiCard
          label="Trend Slope"
          value={`${forecastResult.trendSlopePerPeriod >= 0 ? '+' : ''}${forecastResult.trendSlopePerPeriod}`}
          trendTone={forecastResult.trendSlopePerPeriod >= 0 ? 'positive' : 'negative'}
          subtext={`Per ${forecastConfig.granularity === 'weekly' ? 'week' : 'month'}`}
        />
      </section>

      {/* Model & Horizon Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Granularity:</span>
            <div className="flex p-1 bg-slate-100 rounded-lg">
              {(['weekly', 'monthly'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() =>
                    setForecastConfig((p) => ({
                      ...p,
                      granularity: g,
                      horizonPeriods: g === 'monthly' ? Math.min(6, p.horizonPeriods) : p.horizonPeriods,
                    }))
                  }
                  className={`px-3 py-1 rounded-md font-medium capitalize ${
                    forecastConfig.granularity === g ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Model:</span>
            <select
              aria-label="Forecasting Model"
              value={forecastConfig.modelType}
              onChange={(e) =>
                setForecastConfig((p) => ({ ...p, modelType: e.target.value as 'holt' | 'linear' }))
              }
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
            >
              <option value="holt">Holt Double Exponential Smoothing</option>
              <option value="linear">OLS Linear Regression Trend</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Horizon:</span>
            <select
              aria-label="Forecast Horizon Periods"
              value={forecastConfig.horizonPeriods}
              onChange={(e) =>
                setForecastConfig((p) => ({ ...p, horizonPeriods: Number(e.target.value) }))
              }
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
            >
              {forecastConfig.granularity === 'weekly' ? (
                <>
                  <option value={4}>Next 4 Weeks</option>
                  <option value={8}>Next 8 Weeks</option>
                  <option value={12}>Next 12 Weeks</option>
                </>
              ) : (
                <>
                  <option value={2}>Next 2 Months</option>
                  <option value={3}>Next 3 Months</option>
                  <option value={6}>Next 6 Months</option>
                </>
              )}
            </select>
          </div>
        </div>
      </section>

      {/* Forecast Chart with 80% & 95% Confidence Intervals */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Historical vs Forecasted Demand ({forecastResult.modelName})
          </h3>
          <p className="text-xs text-slate-500">{forecastResult.modelDescription}</p>
        </div>

        <PlotlyChart
          height={370}
          data={[
            {
              x: forecastResult.points.map((p) => p.period),
              y: forecastResult.points.map((p) => p.upper95),
              type: 'scatter',
              mode: 'lines',
              line: { width: 0 },
              showlegend: false,
              hoverinfo: 'skip',
            },
            {
              x: forecastResult.points.map((p) => p.period),
              y: forecastResult.points.map((p) => p.lower95),
              type: 'scatter',
              mode: 'lines',
              fill: 'tonexty',
              fillcolor: 'rgba(13, 148, 136, 0.12)',
              line: { width: 0 },
              name: '95% Confidence Interval',
            },
            {
              x: forecastResult.points.map((p) => p.period),
              y: forecastResult.points.map((p) => p.upper80),
              type: 'scatter',
              mode: 'lines',
              line: { width: 0 },
              showlegend: false,
              hoverinfo: 'skip',
            },
            {
              x: forecastResult.points.map((p) => p.period),
              y: forecastResult.points.map((p) => p.lower80),
              type: 'scatter',
              mode: 'lines',
              fill: 'tonexty',
              fillcolor: 'rgba(13, 148, 136, 0.22)',
              line: { width: 0 },
              name: '80% Confidence Interval',
            },
            {
              x: forecastResult.points.map((p) => p.period),
              y: forecastResult.points.map((p) => p.actual),
              type: 'scatter',
              mode: 'lines+markers',
              name: 'Historical Actual',
              line: { color: '#0f172a', width: 2.5 },
              marker: { size: 5, color: '#0f172a' },
            },
            {
              x: forecastResult.points.map((p) => p.period),
              y: forecastResult.points.map((p) => p.forecast),
              type: 'scatter',
              mode: 'lines+markers',
              name: 'Forecasted Trend',
              line: { color: '#0d9488', width: 2.5, dash: 'dash' },
              marker: { size: 6, color: '#0d9488' },
            },
          ]}
          layout={{
            margin: { l: 58, r: 20, t: 18, b: 48 },
            xaxis: { title: 'Period', gridcolor: '#f1f5f9' },
            yaxis: { title: metricLabel, gridcolor: '#f1f5f9' },
            legend: { orientation: 'h', y: -0.2 },
          }}
        />
      </section>

      {/* Forecast Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Forecasted Period Schedule
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 text-left font-medium">Forecast Period</th>
                <th className="py-2 text-right font-medium">Point Forecast</th>
                <th className="py-2 text-right font-medium">80% Lower – Upper</th>
                <th className="py-2 text-right font-medium">95% Lower – Upper</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {predPoints.map((pt) => (
                <tr key={pt.period}>
                  <td className="py-2 font-mono font-medium text-slate-900">{pt.period}</td>
                  <td className="py-2 text-right font-mono tabular-nums font-semibold text-teal-700">
                    {capabilities.hasRevenue
                      ? `${curr}${(pt.forecast ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : Math.round(pt.forecast ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-slate-600">
                    {pt.lower80?.toLocaleString()} – {pt.upper80?.toLocaleString()}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-slate-500">
                    {pt.lower95?.toLocaleString()} – {pt.upper95?.toLocaleString()}
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
