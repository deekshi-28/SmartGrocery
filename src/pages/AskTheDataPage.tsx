import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useAnalytics } from '../context/AnalyticsContext';
import { answerDataQuery } from '../analytics/intelligence';
import { AskDataResponse } from '../types/analytics';
import { PlotlyChart } from '../components/PlotlyChart';

const EXAMPLE_QUESTIONS = [
  'Which category has the highest sales?',
  'What are the top 10 products?',
  'Which products are frequently bought together?',
  'What is the average basket value?',
  'Which month had the highest sales?',
  'Show products with declining sales',
  'Which products have the highest association?',
  'What are the shopping patterns on weekends?',
];

export const AskTheDataPage: React.FC = () => {
  const {
    activeDataset,
    capabilities,
    basketAnalytics,
    categoryAnalytics,
    productAnalytics,
    marketBasket,
    shoppingPatterns,
    salesMonthly,
    anomalies,
    customerRFM,
  } = useAnalytics();

  const [inputQuery, setInputQuery] = useState(EXAMPLE_QUESTIONS[0]);
  const [history, setHistory] = useState<AskDataResponse[]>(() => [
    answerDataQuery(EXAMPLE_QUESTIONS[0], {
      datasetName: activeDataset.name,
      currencySymbol: activeDataset.currencySymbol,
      capabilities,
      basket: basketAnalytics,
      categories: categoryAnalytics,
      products: productAnalytics,
      rules: marketBasket.rules,
      patterns: shoppingPatterns,
      salesMonthly,
      anomalies,
      customers: customerRFM,
    }),
  ]);

  const submitQuery = (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;
    const response = answerDataQuery(trimmed, {
      datasetName: activeDataset.name,
      currencySymbol: activeDataset.currencySymbol,
      capabilities,
      basket: basketAnalytics,
      categories: categoryAnalytics,
      products: productAnalytics,
      rules: marketBasket.rules,
      patterns: shoppingPatterns,
      salesMonthly,
      anomalies,
      customers: customerRFM,
    });
    setHistory((prev) => [response, ...prev]);
  };

  return (
    <div className="space-y-6">
      {/* Query Input & Example Prompts */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-slate-900 font-display">
          Ask the Data — Analytical Query Engine
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Query live computed metrics from "{activeDataset.name}". Answers, tables, and charts are derived deterministically from the active dataset.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuery(inputQuery);
          }}
          className="mt-4 flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask a question about categories, products, baskets, associations, trends, or weekends..."
            className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            Run Query
          </button>
        </form>

        <div className="mt-4">
          <div className="text-[11px] font-medium text-slate-500 mb-2">Supported Example Queries:</div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setInputQuery(q);
                  submitQuery(q);
                }}
                className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 rounded-lg transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Query Responses Feed */}
      <section className="space-y-5">
        {history.map((res, idx) => (
          <div key={`${res.query}-${idx}`} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <div className="text-[11px] font-medium text-teal-700">
                  {res.matchedIntent} · {activeDataset.name}
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{res.query}</h3>
              </div>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">{res.answerText}</p>

            {res.keyMetrics.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {res.keyMetrics.map((km) => (
                  <div key={km.label} className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <div className="text-[11px] text-slate-500">{km.label}</div>
                    <div className="mt-0.5 text-sm font-mono font-semibold text-slate-900 truncate">
                      {km.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {res.chartSpec && (
              <div className="pt-2">
                <PlotlyChart
                  height={280}
                  data={[
                    {
                      x: res.chartSpec.labels,
                      y: res.chartSpec.values,
                      type: res.chartSpec.chartType,
                      mode: res.chartSpec.chartType === 'line' ? 'lines+markers' : undefined,
                      marker: { color: '#0d9488' },
                      line: { color: '#0d9488', width: 2.5 },
                    },
                  ]}
                  layout={{
                    title: { text: res.chartSpec.title, font: { size: 13 } },
                    margin: { l: 55, r: 20, t: 38, b: 68 },
                    xaxis: { title: res.chartSpec.xLabel, tickangle: -20 },
                    yaxis: { title: res.chartSpec.yLabel, gridcolor: '#f1f5f9' },
                  }}
                />
              </div>
            )}

            {res.tableHeaders && res.tableRows && res.tableRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      {res.tableHeaders.map((h) => (
                        <th key={h} className="py-2 px-2 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {res.tableRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2 px-2 font-mono text-slate-700">
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {res.followUpSuggestions.length > 0 && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400">Follow-up:</span>
                {res.followUpSuggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      setInputQuery(sug);
                      submitQuery(sug);
                    }}
                    className="text-teal-700 hover:underline font-medium"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
};
