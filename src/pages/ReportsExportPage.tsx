import React from 'react';
import { Download, FileText } from 'lucide-react';
import { useAnalytics } from '../context/AnalyticsContext';
import { downloadCsv, downloadJson, downloadTextReport } from '../utils/exportUtils';

export const ReportsExportPage: React.FC = () => {
  const {
    activeDataset,
    capabilities,
    cleanedPreviewRows,
    qualityReport,
    categoryAnalytics,
    productAnalytics,
    marketBasket,
    forecastResult,
    anomalies,
    businessInsights,
  } = useAnalytics();

  const curr = activeDataset.currencySymbol;

  const generateMarkdownSummary = () => {
    const lines = [
      `# SmartGrocery Analytical Report — ${activeDataset.name}`,
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      '',
      '## 1. Data Quality & Preprocessing Summary (Module 1)',
      `- Raw Records: ${qualityReport.totalRawRows}`,
      `- Cleaned Valid Records: ${qualityReport.totalCleanedRows} (${qualityReport.validRowsPct}%)`,
      `- Data Quality Score: ${qualityReport.qualityScoreBefore}% -> ${qualityReport.qualityScoreAfter}%`,
      `- Standardized Product Names: ${qualityReport.standardizedProductCount}`,
      `- Auto-Tagged Category Records: ${qualityReport.autoTaggedCategoryCount}`,
      '',
      '## 2. Top Categories (Module 2)',
      ...categoryAnalytics.slice(0, 8).map(
        (c, i) =>
          `${i + 1}. ${c.category} — ${c.quantity} units (${c.quantitySharePct}%)${capabilities.hasRevenue && c.revenue !== null ? ` | Revenue: ${curr}${c.revenue}` : ''}`
      ),
      '',
      '## 3. Top Products (Module 2)',
      ...productAnalytics.slice(0, 10).map(
        (p) =>
          `${p.rank}. ${p.productName} (${p.category}) — ${p.totalQuantity} units, ${p.basketPenetrationPct}% penetration`
      ),
      '',
      '## 4. Top Market Basket Rules (Module 3)',
      ...marketBasket.rules.slice(0, 10).map(
        (r, i) =>
          `${i + 1}. ${r.antecedentLabel} -> ${r.consequentLabel} | Support ${(r.support * 100).toFixed(2)}% | Confidence ${(r.confidence * 100).toFixed(1)}% | Lift ${r.lift.toFixed(2)}x`
      ),
      '',
      '## 5. Decision Intelligence Insights',
      ...businessInsights.map((ins) => `- [${ins.pillar}] ${ins.title}: ${ins.summary}`),
    ];
    downloadTextReport(`${activeDataset.id}_executive_report.md`, lines.join('\n'));
  };

  const exportItems = [
    {
      title: 'Cleaned Transaction Dataset',
      description: `${cleanedPreviewRows.length.toLocaleString()} standardized, deduplicated, and taxonomy-tagged rows ready for downstream BI.`,
      format: 'CSV',
      available: cleanedPreviewRows.length > 0,
      onExport: () => downloadCsv(`${activeDataset.id}_cleaned_dataset.csv`, cleanedPreviewRows),
    },
    {
      title: 'Category Analytics Summary',
      description: `${categoryAnalytics.length} categories with unit shares, transaction counts, revenue contributions, and growth metrics.`,
      format: 'CSV',
      available: categoryAnalytics.length > 0,
      onExport: () =>
        downloadCsv(
          `${activeDataset.id}_category_summary.csv`,
          categoryAnalytics.map((c) => ({
            Category: c.category,
            Unique_SKUs: c.uniqueProducts,
            Transactions: c.transactionCount,
            Units_Sold: c.quantity,
            Unit_Share_Pct: c.quantitySharePct,
            Revenue: c.revenue ?? 'Unavailable',
            Revenue_Share_Pct: c.revenueSharePct ?? 'Unavailable',
            Growth_Pct: c.growthPct ?? 'Unavailable',
          }))
        ),
    },
    {
      title: 'Product Performance & Velocity Table',
      description: `${productAnalytics.length} SKUs ranked with fast/steady/slow velocity classifications and penetration percentages.`,
      format: 'CSV',
      available: productAnalytics.length > 0,
      onExport: () =>
        downloadCsv(
          `${activeDataset.id}_product_ranking.csv`,
          productAnalytics.map((p) => ({
            Rank: p.rank,
            Product: p.productName,
            Category: p.category,
            Subcategory: p.subcategory,
            Velocity_Tier: p.velocityTier,
            Units_Sold: p.totalQuantity,
            Baskets: p.transactionCount,
            Basket_Penetration_Pct: p.basketPenetrationPct,
            Total_Revenue: p.totalRevenue ?? 'Unavailable',
            Avg_Unit_Price: p.avgUnitPrice ?? 'Unavailable',
            Growth_Pct: p.growthPct ?? 'Unavailable',
          }))
        ),
    },
    {
      title: 'Market Basket Association Rules',
      description: `${marketBasket.rules.length} mined Apriori rules with Support, Confidence, Lift, Leverage, and Conviction.`,
      format: 'CSV',
      available: marketBasket.rules.length > 0,
      onExport: () =>
        downloadCsv(
          `${activeDataset.id}_association_rules.csv`,
          marketBasket.rules.map((r) => ({
            Antecedent: r.antecedentLabel,
            Consequent: r.consequentLabel,
            Co_Occurrence_Baskets: r.coOccurrenceCount,
            Support: r.support,
            Confidence: r.confidence,
            Lift: r.lift,
            Leverage: r.leverage,
            Conviction: r.conviction,
          }))
        ),
    },
    {
      title: 'Data Quality & Cleaning Audit Report',
      description: `Full before/after column profiles, missing cell counts, duplicate counts, and quality score (${qualityReport.qualityScoreBefore}% -> ${qualityReport.qualityScoreAfter}%).`,
      format: 'JSON',
      available: true,
      onExport: () => downloadJson(`${activeDataset.id}_data_quality_audit.json`, qualityReport),
    },
    {
      title: 'Sales Forecasting & Confidence Bands',
      description: forecastResult.supported
        ? `${forecastResult.modelName} horizon predictions with 80% and 95% confidence bounds.`
        : 'Unavailable because the active dataset lacks calendar purchase dates.',
      format: 'CSV',
      available: forecastResult.supported,
      onExport: () =>
        downloadCsv(
          `${activeDataset.id}_sales_forecast.csv`,
          forecastResult.points.map((pt) => ({
            Period: pt.period,
            Historical_Actual: pt.actual ?? '',
            Forecast: pt.forecast ?? '',
            Lower_80: pt.lower80 ?? '',
            Upper_80: pt.upper80 ?? '',
            Lower_95: pt.lower95 ?? '',
            Upper_95: pt.upper95 ?? '',
          }))
        ),
    },
    {
      title: 'Detected Statistical Anomalies',
      description: capabilities.hasDate
        ? `${anomalies.length} flagged spikes and drops with Z-scores and diagnostic explanations.`
        : 'Unavailable because the active dataset lacks calendar purchase dates.',
      format: 'CSV',
      available: capabilities.hasDate && anomalies.length > 0,
      onExport: () =>
        downloadCsv(
          `${activeDataset.id}_anomalies.csv`,
          anomalies.map((a) => ({
            Period: a.period,
            Metric: a.metric,
            Entity: a.entityName,
            Type: a.type,
            Severity: a.severity,
            Actual: a.actualValue,
            Expected: a.expectedValue,
            Z_Score: a.zScore,
            Explanation: a.explanation,
          }))
        ),
    },
    {
      title: 'Executive Capstone Summary Report',
      description: 'Structured Markdown report combining Module 1 quality, Module 2 rankings, Module 3 rules, and Decision Intelligence insights.',
      format: 'Markdown',
      available: true,
      onExport: generateMarkdownSummary,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 font-display">
            Reports &amp; Analytical Exports — {activeDataset.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Download cleaned datasets, analytical tables, association rules, quality audits, and forecasts.
          </p>
        </div>
        <button
          type="button"
          onClick={generateMarkdownSummary}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors whitespace-nowrap"
        >
          <FileText className="w-3.5 h-3.5" />
          Download Executive Summary (.md)
        </button>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exportItems.map((item) => (
          <div
            key={item.title}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                <span className="text-xs font-mono text-slate-500">{item.format}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{item.description}</p>
            </div>
            <div>
              <button
                type="button"
                disabled={!item.available}
                onClick={item.onExport}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                  item.available
                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                {item.available ? `Export ${item.format}` : 'Unavailable for Dataset'}
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};
