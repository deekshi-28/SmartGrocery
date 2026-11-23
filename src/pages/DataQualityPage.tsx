import React from 'react';
import { Download } from 'lucide-react';
import { useAnalytics } from '../context/AnalyticsContext';
import { KpiCard } from '../components/KpiCard';
import { PlotlyChart } from '../components/PlotlyChart';
import { downloadJson } from '../utils/exportUtils';

export const DataQualityPage: React.FC = () => {
  const { activeDataset, qualityReport } = useAnalytics();

  const scoreDelta = Number(
    (qualityReport.qualityScoreAfter - qualityReport.qualityScoreBefore).toFixed(1)
  );

  return (
    <div className="space-y-6">
      {/* Quality Score & Comparison Banner */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Quality Score (Before)"
          value={`${qualityReport.qualityScoreBefore}%`}
          subtext="Raw uncleaned file"
        />
        <KpiCard
          label="Quality Score (After)"
          value={`${qualityReport.qualityScoreAfter}%`}
          trendText={`${scoreDelta >= 0 ? '+' : ''}${scoreDelta} pts`}
          trendTone={scoreDelta >= 0 ? 'positive' : 'negative'}
          subtext="Post-preprocessing"
        />
        <KpiCard
          label="Raw Missing Cells"
          value={qualityReport.rawMissingCells.toLocaleString()}
          subtext={`${qualityReport.cleanedMissingCells.toLocaleString()} after cleaning`}
        />
        <KpiCard
          label="Duplicate Rows Found"
          value={qualityReport.duplicateRowsFound.toLocaleString()}
          subtext="Composite key match"
        />
        <KpiCard
          label="Invalid / Cancelled"
          value={(
            qualityReport.cancelledRowsFound +
            qualityReport.invalidQuantityRowsFound +
            qualityReport.invalidPriceRowsFound +
            qualityReport.missingProductRowsFound
          ).toLocaleString()}
          subtext="Flagged in Module 1"
        />
      </section>

      {/* Transparent Formula & Export */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Transparent Data Quality Scoring Formula
          </h2>
          <p className="text-xs text-slate-600 mt-1">{qualityReport.qualityFormulaNote}</p>
        </div>
        <button
          type="button"
          onClick={() => downloadJson(`${activeDataset.id}_data_quality_report.json`, qualityReport)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          Export Quality Report (JSON)
        </button>
      </section>

      {/* Charts: Missingness by Column & Before/After Issue Breakdown */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Missing Values by Raw Column
          </h3>
          <p className="text-xs text-slate-500">
            Count of null or empty cells across raw dataset fields
          </p>
          <PlotlyChart
            height={300}
            data={[
              {
                x: qualityReport.columnProfilesBefore.map((c) => c.name),
                y: qualityReport.columnProfilesBefore.map((c) => c.missingCount),
                type: 'bar',
                marker: { color: '#d97706' },
                name: 'Missing Cells',
              },
            ]}
            layout={{
              margin: { l: 50, r: 20, t: 20, b: 64 },
              xaxis: { title: 'Column', tickangle: -20 },
              yaxis: { title: 'Missing Cell Count', gridcolor: '#f1f5f9' },
            }}
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Detected Anomalies &amp; Hygiene Issues Breakdown
          </h3>
          <p className="text-xs text-slate-500">
            Distribution of data quality issues identified before cleaning
          </p>
          <PlotlyChart
            height={300}
            data={[
              {
                x: [
                  'Cancelled / Returns',
                  'Invalid Qty',
                  'Invalid Price',
                  'Missing Product',
                  'Missing Customer',
                  'Duplicates',
                ],
                y: [
                  qualityReport.cancelledRowsFound,
                  qualityReport.invalidQuantityRowsFound,
                  qualityReport.invalidPriceRowsFound,
                  qualityReport.missingProductRowsFound,
                  qualityReport.missingCustomerRowsFound,
                  qualityReport.duplicateRowsFound,
                ],
                type: 'bar',
                marker: {
                  color: ['#dc2626', '#ea580c', '#d97706', '#e11d48', '#64748b', '#0d9488'],
                },
              },
            ]}
            layout={{
              margin: { l: 50, r: 20, t: 20, b: 64 },
              xaxis: { title: 'Issue Category', tickangle: -15 },
              yaxis: { title: 'Detected Rows', gridcolor: '#f1f5f9' },
            }}
          />
        </div>
      </section>

      {/* Column-Level Before & After Table */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Before Processing — Raw Column Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">Column</th>
                  <th className="py-2 text-left font-medium">Type</th>
                  <th className="py-2 text-right font-medium">Non-Null</th>
                  <th className="py-2 text-right font-medium">Missing (%)</th>
                  <th className="py-2 text-right font-medium">Unique</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {qualityReport.columnProfilesBefore.map((c) => (
                  <tr key={c.name}>
                    <td className="py-2 font-mono text-slate-900">{c.name}</td>
                    <td className="py-2 text-slate-600">{c.detectedType}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {c.nonNullCount.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {c.missingCount} ({c.missingPct}%)
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {c.uniqueCount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            After Processing — Standardized Schema Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">Standard Field</th>
                  <th className="py-2 text-left font-medium">Type</th>
                  <th className="py-2 text-right font-medium">Valid Rows</th>
                  <th className="py-2 text-right font-medium">Missing</th>
                  <th className="py-2 text-right font-medium">Unique</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {qualityReport.columnProfilesAfter.map((c) => (
                  <tr key={c.name}>
                    <td className="py-2 font-mono text-slate-900">{c.name}</td>
                    <td className="py-2 text-slate-600">{c.detectedType}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {c.nonNullCount.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-emerald-700">
                      {c.missingCount} ({c.missingPct}%)
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {c.uniqueCount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
