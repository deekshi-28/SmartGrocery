import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  CleaningConfig,
  ColumnMapping,
  ColumnProfile,
  DatasetCapabilities,
  DatasetSource,
  RawRow,
} from '../types/analytics';
import { DEFAULT_CLEANING_CONFIG } from '../data/sampleDatasets';

export async function parseUploadedFile(file: File): Promise<{
  rows: RawRow[];
  columns: string[];
  format: 'CSV Upload' | 'Excel Upload';
}> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
    return new Promise((resolve, reject) => {
      Papa.parse<RawRow>(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          const rows = (results.data || []).filter((r) => r && Object.keys(r).length > 0);
          const columns = results.meta.fields || (rows[0] ? Object.keys(rows[0]) : []);
          if (columns.length === 0 || rows.length === 0) {
            reject(new Error('The uploaded CSV file contains no readable columns or rows.'));
            return;
          }
          resolve({ rows, columns, format: 'CSV Upload' });
        },
        error: (err) => reject(new Error(`CSV parsing failed: ${err.message}`)),
      });
    });
  }

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('The uploaded Excel workbook has no worksheets.');
    }
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, { defval: null });
    if (rows.length === 0) {
      throw new Error('The first worksheet in the Excel file is empty.');
    }
    const columns = Object.keys(rows[0]);
    return { rows, columns, format: 'Excel Upload' };
  }

  throw new Error('Unsupported file format. Please upload a .csv, .xlsx, or .xls file.');
}

function normalizeColName(col: string): string {
  return col.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findMatchingColumn(columns: string[], candidates: string[]): string | null {
  const normalizedMap = new Map(columns.map((c) => [normalizeColName(c), c]));
  for (const cand of candidates) {
    const exact = normalizedMap.get(cand);
    if (exact) return exact;
  }
  for (const col of columns) {
    const norm = normalizeColName(col);
    if (candidates.some((cand) => norm.includes(cand))) {
      return col;
    }
  }
  return null;
}

export function autoDetectColumnMapping(columns: string[]): ColumnMapping {
  return {
    transactionId: findMatchingColumn(columns, [
      'transactionid',
      'invoiceno',
      'invoice',
      'orderid',
      'basketid',
      'txid',
      'receiptid',
    ]),
    customerId: findMatchingColumn(columns, [
      'customerid',
      'userid',
      'clientid',
      'memberid',
      'custid',
      'accountid',
    ]),
    productName: findMatchingColumn(columns, [
      'productname',
      'description',
      'product',
      'itemname',
      'item',
      'skuname',
      'merchandise',
    ]),
    category: findMatchingColumn(columns, ['category', 'department', 'dept', 'productgroup', 'segment']),
    subcategory: findMatchingColumn(columns, ['subcategory', 'aisle', 'subcat', 'producttype']),
    quantity: findMatchingColumn(columns, ['quantity', 'qty', 'units', 'count', 'itemcount']),
    unitPrice: findMatchingColumn(columns, ['unitprice', 'price', 'rate', 'itemprice', 'cost']),
    totalSales: findMatchingColumn(columns, ['totalsales', 'sales', 'revenue', 'amount', 'totalamount', 'basketvalue', 'linevalue']),
    purchaseDate: findMatchingColumn(columns, [
      'purchasedate',
      'invoicedate',
      'orderdate',
      'date',
      'timestamp',
      'txdate',
      'createdat',
    ]),
    purchaseTime: findMatchingColumn(columns, ['purchasetime', 'time', 'ordertime', 'txtime']),
    dayOfWeek: findMatchingColumn(columns, ['orderdow', 'dayofweek', 'dow', 'weekday']),
    hourOfDay: findMatchingColumn(columns, ['orderhourofday', 'hourofday', 'hour']),
    reordered: findMatchingColumn(columns, ['reordered', 'isreorder', 'repeat']),
    daysSincePrior: findMatchingColumn(columns, ['dayssincepriororder', 'dayssinceprior', 'recencydays']),
  };
}

export function detectDatasetCapabilities(mapping: ColumnMapping, rows: RawRow[]): DatasetCapabilities {
  const sampleLimit = Math.min(rows.length, 150);
  let hasDateValues = false;
  let hasTimeValues = false;
  let hasPriceValues = false;
  let hasRevenueValues = false;

  if (mapping.purchaseDate) {
    for (let i = 0; i < sampleLimit; i++) {
      const val = rows[i]?.[mapping.purchaseDate];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        hasDateValues = true;
        if (String(val).includes(':')) hasTimeValues = true;
        break;
      }
    }
  }

  if (mapping.purchaseTime) {
    for (let i = 0; i < sampleLimit; i++) {
      const val = rows[i]?.[mapping.purchaseTime];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        hasTimeValues = true;
        break;
      }
    }
  }

  if (mapping.unitPrice) {
    for (let i = 0; i < sampleLimit; i++) {
      const num = Number(rows[i]?.[mapping.unitPrice]);
      if (!Number.isNaN(num) && num > 0) {
        hasPriceValues = true;
        break;
      }
    }
  }

  if (mapping.totalSales) {
    for (let i = 0; i < sampleLimit; i++) {
      const num = Number(rows[i]?.[mapping.totalSales]);
      if (!Number.isNaN(num) && num > 0) {
        hasRevenueValues = true;
        break;
      }
    }
  }

  const hasPrice = Boolean(mapping.unitPrice && hasPriceValues);
  const hasRevenue = Boolean(hasPrice || (mapping.totalSales && hasRevenueValues));

  return {
    hasTransactionId: Boolean(mapping.transactionId),
    hasCustomerId: Boolean(mapping.customerId),
    hasCategory: Boolean(mapping.category),
    hasQuantity: Boolean(mapping.quantity),
    hasPrice,
    hasRevenue,
    hasDate: Boolean(mapping.purchaseDate && hasDateValues),
    hasTime: hasTimeValues || Boolean(mapping.hourOfDay),
    hasHour: hasTimeValues || Boolean(mapping.hourOfDay),
    hasDow: Boolean(mapping.dayOfWeek) || Boolean(mapping.purchaseDate && hasDateValues),
    hasReorder: Boolean(mapping.reordered),
    hasDaysSincePrior: Boolean(mapping.daysSincePrior),
  };
}

export function profileColumns(rows: RawRow[], columns: string[]): ColumnProfile[] {
  return columns.map((col) => {
    let nonNullCount = 0;
    let missingCount = 0;
    let numCount = 0;
    let dateCount = 0;
    let boolCount = 0;
    let strCount = 0;
    const unique = new Set<string>();
    const samples: string[] = [];

    for (const row of rows) {
      const val = row[col];
      if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
        missingCount++;
        continue;
      }
      nonNullCount++;
      const str = String(val).trim();
      unique.add(str);
      if (samples.length < 3 && !samples.includes(str)) {
        samples.push(str);
      }

      if (typeof val === 'boolean') {
        boolCount++;
      } else if (typeof val === 'number' && !Number.isNaN(val)) {
        numCount++;
      } else if (val instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(str) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(str)) {
        dateCount++;
      } else if (!Number.isNaN(Number(str)) && str !== '') {
        numCount++;
      } else {
        strCount++;
      }
    }

    let detectedType: ColumnProfile['detectedType'] = 'string';
    if (nonNullCount > 0) {
      if (dateCount / nonNullCount >= 0.7) detectedType = 'date';
      else if (numCount / nonNullCount >= 0.85) detectedType = 'number';
      else if (boolCount / nonNullCount >= 0.85) detectedType = 'boolean';
      else if (strCount / nonNullCount >= 0.7) detectedType = 'string';
      else detectedType = 'mixed';
    }

    return {
      name: col,
      detectedType,
      nonNullCount,
      missingCount,
      missingPct: rows.length > 0 ? Number(((missingCount / rows.length) * 100).toFixed(1)) : 0,
      uniqueCount: unique.size,
      sampleValues: samples,
    };
  });
}

export function createUploadedDatasetSource(
  fileName: string,
  rows: RawRow[],
  columns: string[],
  format: 'CSV Upload' | 'Excel Upload'
): DatasetSource {
  const mapping = autoDetectColumnMapping(columns);
  const capabilities = detectDatasetCapabilities(mapping, rows);
  const cleaningConfig: CleaningConfig = {
    ...DEFAULT_CLEANING_CONFIG,
    removeInvalidPrices: capabilities.hasPrice,
  };

  return {
    id: `custom_${Date.now()}`,
    name: fileName.replace(/\.(csv|xlsx|xls|txt)$/i, ''),
    kind: 'custom',
    description: `User-uploaded ${format === 'CSV Upload' ? 'CSV' : 'Excel'} dataset (${rows.length.toLocaleString()} raw rows, ${columns.length} columns).`,
    currencySymbol: '$',
    sourceFormat: format,
    fileName,
    uploadedAt: new Date().toISOString().slice(0, 10),
    rawRows: rows,
    columns,
    mapping,
    cleaningConfig,
    notes: [
      `Imported from ${fileName} (${format}).`,
      capabilities.hasRevenue
        ? 'Monetary columns detected; basket value and revenue analytics enabled.'
        : 'No unit price or sales column mapped; monetary analytics disabled.',
      capabilities.hasDate
        ? 'Date column detected; time-series, forecasting, and anomaly detection enabled.'
        : 'No calendar date column mapped; time-series forecasting disabled.',
    ],
  };
}
