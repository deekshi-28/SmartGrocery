import React, { useRef, useState } from 'react';
import { Check, FileSpreadsheet, Upload, AlertCircle, ArrowRight } from 'lucide-react';
import { useAnalytics } from '../context/AnalyticsContext';
import { createUploadedDatasetSource, parseUploadedFile, profileColumns } from '../analytics/fileParser';
import { ColumnMapping } from '../types/analytics';

export const DatasetManagementPage: React.FC = () => {
  const {
    datasets,
    activeDataset,
    selectDataset,
    addUploadedDataset,
    updateDatasetMapping,
    capabilities,
    setActivePage,
  } = useAnalytics();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [showArchitecture, setShowArchitecture] = useState(false);

  const profiles = profileColumns(activeDataset.rawRows, activeDataset.columns);
  const previewRows = activeDataset.rawRows.slice(0, 12);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus({ type: 'loading', message: `Parsing ${file.name}...` });
    try {
      const parsed = await parseUploadedFile(file);
      const newSource = createUploadedDatasetSource(
        file.name,
        parsed.rows,
        parsed.columns,
        parsed.format
      );
      addUploadedDataset(newSource);
      setUploadStatus({
        type: 'success',
        message: `Loaded "${newSource.name}" (${parsed.rows.length.toLocaleString()} rows, ${parsed.columns.length} columns).`,
      });
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to parse file.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleMapChange = (field: keyof ColumnMapping, colName: string) => {
    updateDatasetMapping(activeDataset.id, {
      ...activeDataset.mapping,
      [field]: colName === '' ? null : colName,
    });
  };

  const mappingFields: { key: keyof ColumnMapping; label: string; hint: string }[] = [
    { key: 'transactionId', label: 'Transaction / Order ID', hint: 'InvoiceNo, order_id, basket_id' },
    { key: 'productName', label: 'Product Name / Description', hint: 'Description, product_name, SKU' },
    { key: 'category', label: 'Category / Department', hint: 'Optional; auto-tagged if absent' },
    { key: 'subcategory', label: 'Subcategory / Aisle', hint: 'Optional sub-level taxonomy' },
    { key: 'quantity', label: 'Quantity', hint: 'Units purchased per line' },
    { key: 'unitPrice', label: 'Unit Price', hint: 'Price per single unit' },
    { key: 'totalSales', label: 'Line Total / Sales', hint: 'Used if Unit Price is absent' },
    { key: 'purchaseDate', label: 'Purchase Date', hint: 'Calendar timestamp or date' },
    { key: 'purchaseTime', label: 'Purchase Time', hint: 'HH:MM time string' },
    { key: 'customerId', label: 'Customer ID', hint: 'CustomerID, user_id' },
    { key: 'dayOfWeek', label: 'Day of Week (0-6)', hint: 'e.g. Instacart order_dow' },
    { key: 'hourOfDay', label: 'Hour of Day (0-23)', hint: 'e.g. order_hour_of_day' },
    { key: 'reordered', label: 'Reordered Flag (0/1)', hint: 'Repeat purchase indicator' },
  ];

  return (
    <div className="space-y-6">
      {/* Upload & Dataset Switcher */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 font-display">
              Upload Transaction Dataset
            </h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Import your own grocery or retail transaction CSV or Excel (.xlsx, .xls) file. Schemas are automatically profiled and strictly isolated from built-in datasets.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 w-full border-2 border-dashed border-slate-300 hover:border-teal-600 rounded-xl p-6 text-center transition-colors bg-slate-50/50 hover:bg-teal-50/30 cursor-pointer"
            >
              <Upload className="w-6 h-6 text-teal-700 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-800">
                Select CSV or Excel File
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Supports .csv, .xlsx, and .xls with automatic column detection
              </div>
            </button>

            {uploadStatus.type !== 'idle' && (
              <div
                className={`mt-3 p-3 rounded-lg text-xs border flex items-start gap-2 ${
                  uploadStatus.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : uploadStatus.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadStatus.message}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowArchitecture((v) => !v)}
              className="text-teal-700 hover:text-teal-800 font-medium"
            >
              {showArchitecture ? 'Hide Reference Architecture' : 'View Reference Architecture Diagram'}
            </button>
            <button
              type="button"
              onClick={() => setActivePage('preprocessing')}
              className="inline-flex items-center gap-1 font-medium text-slate-800 hover:text-teal-700"
            >
              Go to Preprocessing <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Separated Dataset Switcher */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 font-display">
                Available Isolated Datasets
              </h2>
              <p className="text-xs text-slate-500">
                Instacart, UCI Online Retail, and uploaded files remain strictly separated and never merged.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {datasets.map((ds) => {
              const isSelected = ds.id === activeDataset.id;
              return (
                <div
                  key={ds.id}
                  onClick={() => selectDataset(ds.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/30'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                        <span className="text-sm font-semibold text-slate-900">{ds.name}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">{ds.sourceFormat}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{ds.description}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums text-slate-500">
                        <span>{ds.rawRows.length.toLocaleString()} raw rows</span>
                        <span>{ds.columns.length} columns</span>
                        <span>Loaded {ds.uploadedAt}</span>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded-md shrink-0 ${
                        isSelected
                          ? 'bg-teal-700 text-white inline-flex items-center gap-1'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {isSelected ? 'Active' : 'Select'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {showArchitecture && (
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                SmartGrocery Reference Architecture Diagram
              </h3>
              <p className="text-xs text-slate-500">
                Data Source -&gt; Module 1 -&gt; Module 2 &amp; Module 3 -&gt; Decision Intelligence Layer -&gt; Interactive Dashboard
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowArchitecture(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>
          <img
            src="/assets/aistudio/SmartGrocery_Analytics_Architecture_Flowchart_1b9ffc72.png"
            alt="SmartGrocery System Architecture Diagram"
            className="w-full max-w-4xl mx-auto rounded-lg border border-slate-200"
          />
        </section>
      )}

      {/* Dataset Notes & Dynamic Capabilities */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900">
          Schema Capabilities &amp; Analytical Guardrails
        </h3>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          {[
            { label: 'Transaction ID', ok: capabilities.hasTransactionId },
            { label: 'Unit Price / Revenue', ok: capabilities.hasRevenue },
            { label: 'Quantity', ok: capabilities.hasQuantity },
            { label: 'Calendar Date', ok: capabilities.hasDate },
            { label: 'Hour / Time', ok: capabilities.hasHour },
            { label: 'Customer ID', ok: capabilities.hasCustomerId },
          ].map((cap) => (
            <div
              key={cap.label}
              className="p-3 rounded-lg border border-slate-200 bg-slate-50/50"
            >
              <div className="text-slate-500">{cap.label}</div>
              <div className={`mt-1 font-medium ${cap.ok ? 'text-emerald-700' : 'text-slate-400'}`}>
                {cap.ok ? 'Supported' : 'Not in Schema'}
              </div>
            </div>
          ))}
        </div>
        {activeDataset.notes.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-slate-600 list-disc pl-5">
            {activeDataset.notes.map((n, idx) => (
              <li key={idx}>{n}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Interactive Column Mapping */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Column Mapping Configuration
          </h3>
          <p className="text-xs text-slate-500">
            Verify or manually adjust how columns in "{activeDataset.name}" map to analytical fields. All modules recalculate immediately.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mappingFields.map((f) => (
            <div key={f.key} className="p-3 rounded-lg border border-slate-200 bg-slate-50/40">
              <label className="block text-xs font-medium text-slate-800">{f.label}</label>
              <div className="text-[11px] text-slate-400 mb-1.5">{f.hint}</div>
              <select
                value={activeDataset.mapping[f.key] || ''}
                onChange={(e) => handleMapChange(f.key, e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-teal-600"
              >
                <option value="">-- Not Mapped --</option>
                {activeDataset.columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* Column Profiles & Raw Dataset Preview */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Detected Columns &amp; Data Types ({profiles.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">Column</th>
                  <th className="py-2 text-left font-medium">Type</th>
                  <th className="py-2 text-right font-medium">Unique</th>
                  <th className="py-2 text-right font-medium">Missing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((p) => (
                  <tr key={p.name}>
                    <td className="py-2 font-mono text-slate-900">{p.name}</td>
                    <td className="py-2 text-slate-600">{p.detectedType}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {p.uniqueCount.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {p.missingCount} ({p.missingPct}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Raw Dataset Preview (First 12 Rows)
          </h3>
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
                {previewRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {activeDataset.columns.map((col) => {
                      const val = row[col];
                      const isEmpty = val === null || val === undefined || String(val).trim() === '';
                      return (
                        <td
                          key={col}
                          className={`py-2 px-2 whitespace-nowrap font-mono ${
                            isEmpty ? 'text-rose-500 italic' : 'text-slate-700'
                          }`}
                        >
                          {isEmpty ? 'null' : String(val)}
                        </td>
                      );
                    })}
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
