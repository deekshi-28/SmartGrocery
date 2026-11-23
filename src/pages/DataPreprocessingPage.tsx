import React, { useMemo, useState } from 'react';
import { Download, ArrowRight } from 'lucide-react';
import { useAnalytics } from '../context/AnalyticsContext';
import { CleaningConfig } from '../types/analytics';
import { getTaxonomyHierarchy } from '../analytics/taxonomy';
import { KpiCard } from '../components/KpiCard';
import { downloadCsv } from '../utils/exportUtils';

export const DataPreprocessingPage: React.FC = () => {
  const {
    activeDataset,
    updateCleaningConfig,
    capabilities,
    qualityReport,
    cleanedTransactions,
    cleanedPreviewRows,
    setActivePage,
  } = useAnalytics();

  const [previewTab, setPreviewTab] = useState<'cleaned' | 'raw' | 'taxonomy'>('cleaned');

  const taxonomyTree = useMemo(
    () => getTaxonomyHierarchy(cleanedTransactions),
    [cleanedTransactions]
  );

  const toggleRule = (key: keyof CleaningConfig) => {
    updateCleaningConfig(activeDataset.id, {
      ...activeDataset.cleaningConfig,
      [key]: !activeDataset.cleaningConfig[key],
    });
  };

  const ruleControls: {
    key: keyof CleaningConfig;
    label: string;
    detectedText: string;
    disabled?: boolean;
  }[] = [
    {
      key: 'removeCancelledInvoices',
      label: 'Exclude Cancelled Orders & Negative Returns',
      detectedText: `${qualityReport.cancelledRowsFound} cancelled/return rows detected`,
    },
    {
      key: 'removeInvalidQuantities',
      label: 'Remove Invalid Quantities (<= 0 or NaN)',
      detectedText: `${qualityReport.invalidQuantityRowsFound} invalid quantity rows detected`,
    },
    {
      key: 'removeInvalidPrices',
      label: 'Remove Invalid Unit Prices (<= 0 or Null)',
      detectedText: capabilities.hasPrice
        ? `${qualityReport.invalidPriceRowsFound} invalid price rows detected`
        : 'No unit price column in dataset',
      disabled: !capabilities.hasPrice,
    },
    {
      key: 'removeMissingProducts',
      label: 'Remove Records Missing Product Description',
      detectedText: `${qualityReport.missingProductRowsFound} missing product names detected`,
    },
    {
      key: 'removeMissingCustomers',
      label: 'Drop Rows Missing Customer Identifier',
      detectedText: capabilities.hasCustomerId
        ? `${qualityReport.missingCustomerRowsFound} missing CustomerIDs (unchecked = keep as Guest)`
        : 'No CustomerID column in dataset',
      disabled: !capabilities.hasCustomerId,
    },
    {
      key: 'removeDuplicates',
      label: 'Deduplicate Exact Repeated Line Items',
      detectedText: `${qualityReport.duplicateRowsFound} duplicate lines detected`,
    },
    {
      key: 'standardizeProductNames',
      label: 'Standardize Product Names & Units',
      detectedText: `${qualityReport.standardizedProductCount} strings standardized`,
    },
    {
      key: 'autoTagCategories',
      label: 'Product Tagging & Category Taxonomy Mapping',
      detectedText: `${qualityReport.autoTaggedCategoryCount} records tagged into 2-level taxonomy`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Before vs After Summary KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Raw Records"
          value={qualityReport.totalRawRows.toLocaleString()}
          subtext="Before preprocessing"
        />
        <KpiCard
          label="Cleaned Valid Records"
          value={qualityReport.totalCleanedRows.toLocaleString()}
          subtext={`${qualityReport.validRowsPct}% retained`}
          trendTone="positive"
        />
        <KpiCard
          label="Excluded Records"
          value={qualityReport.removedRows.toLocaleString()}
          subtext="Transparently logged below"
        />
        <KpiCard
          label="Standardized Names"
          value={qualityReport.standardizedProductCount.toLocaleString()}
          subtext="Whitespace, casing & aliases"
        />
        <KpiCard
          label="Taxonomy Mapped"
          value={taxonomyTree.length.toString()}
          subtext="Categories · Click Data Quality"
          onClick={() => setActivePage('quality')}
        />
      </section>

      {/* Cleaning Operations Control Panel + Log */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-slate-900 font-display">
            Preprocessing &amp; Tagging Rules
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Toggle any cleaning operation to inspect its exact effect on dataset volume and downstream analytics.
          </p>

          <div className="mt-4 space-y-2.5">
            {ruleControls.map((ctrl) => {
              const checked = activeDataset.cleaningConfig[ctrl.key];
              return (
                <label
                  key={ctrl.key}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    ctrl.disabled
                      ? 'bg-slate-50 border-slate-200/70 opacity-60 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-teal-500 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={ctrl.disabled}
                    checked={checked}
                    onChange={() => toggleRule(ctrl.key)}
                    className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900">{ctrl.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{ctrl.detectedText}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 font-display">
                  Cleaning Operations Audit Log
                </h2>
                <p className="text-xs text-slate-500">
                  No data is silently deleted; every transformation and row count is recorded.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('quality')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 whitespace-nowrap"
              >
                Quality Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 text-left font-medium">Operation</th>
                    <th className="py-2 text-left font-medium">Status</th>
                    <th className="py-2 text-right font-medium">Affected Rows</th>
                    <th className="py-2 text-left font-medium pl-3">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {qualityReport.cleaningLog.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 font-medium text-slate-900">{log.action}</td>
                      <td className="py-2.5">
                        <span
                          className={`text-[11px] font-medium ${
                            log.status === 'applied'
                              ? 'text-emerald-700'
                              : log.status === 'skipped'
                                ? 'text-amber-700'
                                : 'text-slate-400'
                          }`}
                        >
                          {log.status === 'applied'
                            ? 'Applied'
                            : log.status === 'skipped'
                              ? 'Skipped'
                              : 'N/A'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-800">
                        {log.affectedRows.toLocaleString()}
                      </td>
                      <td className="py-2.5 pl-3 text-slate-600">{log.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              Quality Score: <span className="font-mono font-semibold text-slate-900">{qualityReport.qualityScoreBefore}%</span>{' '}
              -&gt; <span className="font-mono font-semibold text-emerald-700">{qualityReport.qualityScoreAfter}%</span>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  `${activeDataset.id}_cleaned_transactions.csv`,
                  cleanedPreviewRows
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export Cleaned Dataset (CSV)
            </button>
          </div>
        </div>
      </section>

      {/* Preview Tabs: Cleaned vs Raw vs Product Taxonomy Hierarchy */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'cleaned' as const, label: 'Cleaned Dataset Preview' },
              { id: 'raw' as const, label: 'Raw Dataset Preview' },
              { id: 'taxonomy' as const, label: 'Product Taxonomy Hierarchy' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPreviewTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  previewTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Showing sample of {cleanedPreviewRows.length.toLocaleString()} cleaned rows
          </div>
        </div>

        {previewTab === 'cleaned' && cleanedPreviewRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  {Object.keys(cleanedPreviewRows[0]).map((col) => (
                    <th key={col} className="py-2 px-2 text-left font-medium whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cleanedPreviewRows.slice(0, 15).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {Object.keys(cleanedPreviewRows[0]).map((col) => (
                      <td key={col} className="py-2 px-2 whitespace-nowrap font-mono text-slate-700">
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {previewTab === 'raw' && activeDataset.rawRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  {activeDataset.columns.map((col) => (
                    <th key={col} className="py-2 px-2 text-left font-medium whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeDataset.rawRows.slice(0, 15).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {activeDataset.columns.map((col) => (
                      <td key={col} className="py-2 px-2 whitespace-nowrap font-mono text-slate-700">
                        {row[col] === null || row[col] === undefined || String(row[col]).trim() === ''
                          ? 'null'
                          : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {previewTab === 'taxonomy' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {taxonomyTree.map((cat) => (
              <div key={cat.category} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">{cat.category}</h4>
                  <span className="text-xs font-mono text-slate-500">
                    {cat.subcategories.length} subcats
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {cat.subcategories.map((sub) => (
                    <div key={sub.name} className="text-xs">
                      <div className="flex items-center justify-between font-medium text-slate-800">
                        <span>{sub.name}</span>
                        <span className="font-mono text-slate-500">{sub.productCount} SKUs</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {sub.products.slice(0, 4).join(', ')}
                        {sub.products.length > 4 ? ` +${sub.products.length - 4} more` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
