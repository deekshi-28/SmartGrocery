import React, { useMemo, useState } from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import { EmptyOrUnsupportedState } from '../components/EmptyOrUnsupportedState';
import { KpiCard } from '../components/KpiCard';
import { PlotlyChart } from '../components/PlotlyChart';
import { CustomerSegment } from '../types/analytics';

export const CustomerAnalyticsPage: React.FC = () => {
  const { activeDataset, capabilities, customerRFM } = useAnalytics();
  const curr = activeDataset.currencySymbol;
  const fmtMoney = (v: number | null) =>
    v === null ? 'N/A' : `${curr}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [segmentFilter, setSegmentFilter] = useState<'ALL' | CustomerSegment>('ALL');
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);

  if (!capabilities.hasCustomerId || customerRFM.length === 0) {
    return (
      <EmptyOrUnsupportedState
        title="Customer Identifiers Unavailable"
        description="RFM segmentation requires a mapped Customer ID / User ID column. Map a customer identifier in Dataset Management or switch to UCI Online Retail / Instacart."
        suggestionLabel="Configure Column Mapping"
        targetPage="datasets"
      />
    );
  }

  const segments: CustomerSegment[] = ['VIP', 'Loyal', 'Regular', 'At-Risk', 'Inactive'];
  const segmentCounts = useMemo(() => {
    const map = new Map<CustomerSegment, number>(segments.map((s) => [s, 0]));
    customerRFM.forEach((c) => map.set(c.segment, (map.get(c.segment) ?? 0) + 1));
    return segments.map((s) => ({ segment: s, count: map.get(s) ?? 0 }));
  }, [customerRFM]);

  const filteredCustomers = useMemo(
    () =>
      segmentFilter === 'ALL'
        ? customerRFM
        : customerRFM.filter((c) => c.segment === segmentFilter),
    [customerRFM, segmentFilter]
  );

  const activeCustomer = useMemo(
    () =>
      filteredCustomers.find((c) => c.customerId === selectedCustId) ||
      filteredCustomers[0] ||
      null,
    [filteredCustomers, selectedCustId]
  );

  const avgFreq = Number(
    (customerRFM.reduce((s, c) => s + c.frequency, 0) / customerRFM.length).toFixed(2)
  );
  const avgMonetary = capabilities.hasRevenue
    ? Number(
        (customerRFM.reduce((s, c) => s + (c.monetary ?? 0), 0) / customerRFM.length).toFixed(2)
      )
    : null;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Customers" value={customerRFM.length.toLocaleString()} subtext="Unique customer IDs" />
        <KpiCard
          label="VIP Customers"
          value={(segmentCounts.find((s) => s.segment === 'VIP')?.count ?? 0).toString()}
          subtext="Top RFM quintiles"
          trendTone="positive"
        />
        <KpiCard label="Avg Order Frequency" value={`${avgFreq} orders`} subtext="Per active customer" />
        <KpiCard
          label="Avg Customer Spend"
          value={capabilities.hasRevenue ? fmtMoney(avgMonetary) : 'Unavailable'}
          subtext={capabilities.hasRevenue ? 'Lifetime in window' : 'No price column'}
          unavailable={!capabilities.hasRevenue}
        />
      </section>

      {/* Segment Distribution & Scatter */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">RFM Segment Distribution</h3>
          <p className="text-xs text-slate-500">
            Customers grouped by Recency, Frequency, {capabilities.hasRevenue ? '& Monetary' : 'scores'}
          </p>
          <PlotlyChart
            height={300}
            data={[
              {
                x: segmentCounts.map((s) => s.segment),
                y: segmentCounts.map((s) => s.count),
                type: 'bar',
                marker: {
                  color: ['#0d9488', '#2563eb', '#475569', '#d97706', '#dc2626'],
                },
              },
            ]}
            layout={{
              margin: { l: 48, r: 20, t: 18, b: 42 },
              xaxis: { title: 'Customer Segment' },
              yaxis: { title: 'Customer Count', gridcolor: '#f1f5f9' },
            }}
          />
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            {capabilities.hasRevenue
              ? 'Customer Frequency vs Total Spend'
              : 'Customer Frequency vs Avg Basket Size'}
          </h3>
          <p className="text-xs text-slate-500">
            Click any customer point to inspect individual RFM metrics
          </p>
          <PlotlyChart
            height={300}
            data={segments.map((seg, idx) => {
              const subset = customerRFM.filter((c) => c.segment === seg);
              const colors = ['#0d9488', '#2563eb', '#475569', '#d97706', '#dc2626'];
              return {
                x: subset.map((c) => c.frequency),
                y: subset.map((c) => (capabilities.hasRevenue ? (c.monetary ?? 0) : c.avgBasketSize)),
                text: subset.map((c) => c.customerId),
                mode: 'markers',
                type: 'scatter',
                name: seg,
                marker: { size: 9, color: colors[idx], opacity: 0.85 },
              };
            })}
            layout={{
              margin: { l: 55, r: 20, t: 18, b: 48 },
              xaxis: { title: 'Purchase Frequency (Orders)', gridcolor: '#f1f5f9' },
              yaxis: {
                title: capabilities.hasRevenue ? `Total Spend (${curr})` : 'Avg Basket Size (Items)',
                gridcolor: '#f1f5f9',
              },
              legend: { orientation: 'h', y: -0.22 },
            }}
            onPointClick={(ev) => {
              const cid = ev?.points?.[0]?.text;
              if (cid) setSelectedCustId(String(cid));
            }}
          />
        </div>
      </section>

      {/* Customer Table + Drill-Down */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Customer RFM Directory</h3>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              {(['ALL', ...segments] as const).map((seg) => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setSegmentFilter(seg)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                    segmentFilter === seg ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {seg}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">Customer ID</th>
                  <th className="py-2 text-left font-medium">Segment</th>
                  <th className="py-2 text-right font-medium">Recency</th>
                  <th className="py-2 text-right font-medium">Orders</th>
                  <th className="py-2 text-right font-medium">Avg Size</th>
                  {capabilities.hasRevenue && <th className="py-2 text-right font-medium">Total Spend</th>}
                  <th className="py-2 text-right font-medium">RFM Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.slice(0, 60).map((c) => (
                  <tr
                    key={c.customerId}
                    onClick={() => setSelectedCustId(c.customerId)}
                    className={`cursor-pointer transition-colors ${
                      activeCustomer?.customerId === c.customerId ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2 font-mono font-medium text-slate-900">{c.customerId}</td>
                    <td className="py-2 text-slate-700 font-medium">{c.segment}</td>
                    <td className="py-2 text-right font-mono text-slate-600">{c.recencyLabel}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">{c.frequency}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {c.avgBasketSize}
                    </td>
                    {capabilities.hasRevenue && (
                      <td className="py-2 text-right font-mono tabular-nums font-medium text-slate-900">
                        {fmtMoney(c.monetary)}
                      </td>
                    )}
                    <td className="py-2 text-right font-mono tabular-nums text-teal-700">
                      {c.rfmComposite.toFixed(1)} / 5
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">Customer Drill-Down</h3>
          {activeCustomer ? (
            <div className="mt-3 space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-mono text-sm font-semibold text-slate-900">
                  {activeCustomer.customerId}
                </div>
                <div className="text-teal-700 font-medium mt-0.5">
                  Segment: {activeCustomer.segment} · Composite {activeCustomer.rfmComposite} / 5
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Recency Score (R)</span>
                  <span className="font-mono font-medium text-slate-900">
                    {activeCustomer.rScore} / 5 ({activeCustomer.recencyLabel})
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Frequency Score (F)</span>
                  <span className="font-mono font-medium text-slate-900">
                    {activeCustomer.fScore} / 5 ({activeCustomer.frequency} orders)
                  </span>
                </div>
                {capabilities.hasRevenue && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Monetary Score (M)</span>
                    <span className="font-mono font-medium text-slate-900">
                      {activeCustomer.mScore} / 5 ({fmtMoney(activeCustomer.monetary)})
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Avg Basket Size</span>
                  <span className="font-mono font-medium text-slate-900">
                    {activeCustomer.avgBasketSize} items
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Top Category Affinity</span>
                  <span className="font-medium text-slate-900">{activeCustomer.favoriteCategory}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Select a customer row to inspect details.</p>
          )}
        </div>
      </section>
    </div>
  );
};
