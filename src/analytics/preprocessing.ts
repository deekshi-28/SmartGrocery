import {
  CleanedTransaction,
  CleaningActionLog,
  CleaningConfig,
  ColumnMapping,
  DataQualityReport,
  DatasetCapabilities,
  RawRow,
} from '../types/analytics';
import { profileColumns } from './fileParser';
import { mapProductTaxonomy, standardizeProductName } from './taxonomy';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDateTime(
  dateVal: unknown,
  timeVal: unknown
): { dateStr: string | null; timeStr: string | null; dow: number | null; hour: number | null } {
  let dateStr: string | null = null;
  let timeStr: string | null = null;
  let dow: number | null = null;
  let hour: number | null = null;

  if (dateVal instanceof Date && !Number.isNaN(dateVal.getTime())) {
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    dateStr = `${y}-${m}-${d}`;
    dow = dateVal.getDay();
    hour = dateVal.getHours();
    timeStr = `${String(hour).padStart(2, '0')}:${String(dateVal.getMinutes()).padStart(2, '0')}`;
  } else if (dateVal !== null && dateVal !== undefined && String(dateVal).trim() !== '') {
    const raw = String(dateVal).trim();
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${d}`;
      dow = parsed.getDay();
      if (raw.includes(':')) {
        hour = parsed.getHours();
        timeStr = `${String(hour).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
      }
    } else {
      const isoMatch = raw.match(/(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) {
        dateStr = isoMatch[1];
        const dObj = new Date(`${dateStr}T00:00:00`);
        if (!Number.isNaN(dObj.getTime())) dow = dObj.getDay();
      }
    }
  }

  if (timeVal !== null && timeVal !== undefined && String(timeVal).trim() !== '') {
    const tRaw = String(timeVal).trim();
    const match = tRaw.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const h = Math.min(23, Math.max(0, Number(match[1])));
      const m = Math.min(59, Math.max(0, Number(match[2])));
      hour = h;
      timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  return { dateStr, timeStr, dow, hour };
}

export interface PreprocessingOutput {
  cleanedTransactions: CleanedTransaction[];
  cleanedPreviewRows: RawRow[];
  qualityReport: DataQualityReport;
}

export function runPreprocessingPipeline(
  rawRows: RawRow[],
  columns: string[],
  mapping: ColumnMapping,
  capabilities: DatasetCapabilities,
  config: CleaningConfig
): PreprocessingOutput {
  const totalRawRows = rawRows.length;
  const columnProfilesBefore = profileColumns(rawRows, columns);
  const rawMissingCells = columnProfilesBefore.reduce((sum, c) => sum + c.missingCount, 0);

  let cancelledRowsFound = 0;
  let invalidQuantityRowsFound = 0;
  let invalidPriceRowsFound = 0;
  let missingProductRowsFound = 0;
  let missingCustomerRowsFound = 0;
  let duplicateRowsFound = 0;
  let standardizedProductCount = 0;
  let autoTaggedCategoryCount = 0;

  let cancelledRemoved = 0;
  let invalidQtyRemoved = 0;
  let invalidPriceRemoved = 0;
  let missingProductRemoved = 0;
  let missingCustomerRemoved = 0;
  let duplicatesRemoved = 0;

  const seenFingerprints = new Set<string>();
  const cleanedTransactions: CleanedTransaction[] = [];
  const cleanedPreviewRows: RawRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    const rawTxId = mapping.transactionId ? row[mapping.transactionId] : `TX-${i + 1}`;
    const txId = rawTxId !== null && rawTxId !== undefined && String(rawTxId).trim() !== ''
      ? String(rawTxId).trim()
      : `TX-${i + 1}`;

    const rawCustomer = mapping.customerId ? row[mapping.customerId] : null;
    const customerId =
      rawCustomer !== null && rawCustomer !== undefined && String(rawCustomer).trim() !== ''
        ? String(rawCustomer).trim()
        : null;

    const rawProd = mapping.productName ? row[mapping.productName] : null;
    const rawProductStr = rawProd !== null && rawProd !== undefined ? String(rawProd) : '';

    const qtyRaw = mapping.quantity ? Number(row[mapping.quantity]) : 1;
    const priceRaw = mapping.unitPrice ? Number(row[mapping.unitPrice]) : null;
    const totalSalesRaw = mapping.totalSales ? Number(row[mapping.totalSales]) : null;

    // Detect issues on raw row before filtering
    const isCancelled =
      txId.toUpperCase().startsWith('C') ||
      (mapping.quantity !== null && !Number.isNaN(qtyRaw) && qtyRaw < 0);
    if (isCancelled) cancelledRowsFound++;

    const isInvalidQty =
      mapping.quantity !== null && (Number.isNaN(qtyRaw) || qtyRaw <= 0);
    if (isInvalidQty && !isCancelled) invalidQuantityRowsFound++;

    const isInvalidPrice =
      capabilities.hasPrice &&
      mapping.unitPrice !== null &&
      (priceRaw === null || Number.isNaN(priceRaw) || priceRaw <= 0);
    if (isInvalidPrice) invalidPriceRowsFound++;

    const isMissingProd = rawProductStr.trim() === '';
    if (isMissingProd) missingProductRowsFound++;

    const isMissingCust = capabilities.hasCustomerId && customerId === null;
    if (isMissingCust) missingCustomerRowsFound++;

    // Exact duplicate detection across key transaction fields
    const fingerprint = `${txId}||${rawProductStr.trim().toLowerCase()}||${qtyRaw}||${priceRaw ?? ''}||${customerId ?? ''}`;
    const isDuplicate = seenFingerprints.has(fingerprint);
    if (isDuplicate) duplicateRowsFound++;

    // Apply user-configured cleaning filters transparently
    if (config.removeCancelledInvoices && isCancelled) {
      cancelledRemoved++;
      continue;
    }
    if (config.removeInvalidQuantities && isInvalidQty) {
      invalidQtyRemoved++;
      continue;
    }
    if (config.removeInvalidPrices && isInvalidPrice) {
      invalidPriceRemoved++;
      continue;
    }
    if (config.removeMissingProducts && isMissingProd) {
      missingProductRemoved++;
      continue;
    }
    if (config.removeMissingCustomers && isMissingCust) {
      missingCustomerRemoved++;
      continue;
    }
    if (config.removeDuplicates && isDuplicate) {
      duplicatesRemoved++;
      continue;
    }

    seenFingerprints.add(fingerprint);

    const effectiveRawProd = rawProductStr.trim() || 'Unspecified Product';
    const stdResult = config.standardizeProductNames
      ? standardizeProductName(effectiveRawProd)
      : { standardized: effectiveRawProd, changed: false };
    if (stdResult.changed) standardizedProductCount++;

    const explicitCategory = mapping.category && row[mapping.category] ? String(row[mapping.category]) : null;
    const explicitSub = mapping.subcategory && row[mapping.subcategory] ? String(row[mapping.subcategory]) : null;

    const taxonomy = config.autoTagCategories
      ? mapProductTaxonomy(stdResult.standardized, explicitCategory, explicitSub)
      : {
          category: explicitCategory?.trim() || 'Uncategorized',
          subcategory: explicitSub?.trim() || 'General',
          tags: ['Retail Item'],
          wasAutoTagged: false,
        };

    if (taxonomy.wasAutoTagged) autoTaggedCategoryCount++;

    const safeQty = mapping.quantity !== null && !Number.isNaN(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
    let safeUnitPrice: number | null = null;
    let revenue: number | null = null;

    if (capabilities.hasPrice && priceRaw !== null && !Number.isNaN(priceRaw) && priceRaw > 0) {
      safeUnitPrice = Number(priceRaw.toFixed(2));
      revenue = Number((safeQty * safeUnitPrice).toFixed(2));
    } else if (
      capabilities.hasRevenue &&
      totalSalesRaw !== null &&
      !Number.isNaN(totalSalesRaw) &&
      totalSalesRaw > 0
    ) {
      revenue = Number(totalSalesRaw.toFixed(2));
      safeUnitPrice = Number((revenue / safeQty).toFixed(2));
    }

    const parsedDT = parseDateTime(
      mapping.purchaseDate ? row[mapping.purchaseDate] : null,
      mapping.purchaseTime ? row[mapping.purchaseTime] : null
    );

    let dowIndex: number | null = parsedDT.dow;
    if (dowIndex === null && mapping.dayOfWeek && row[mapping.dayOfWeek] !== null && row[mapping.dayOfWeek] !== undefined) {
      const n = Number(row[mapping.dayOfWeek]);
      if (!Number.isNaN(n) && n >= 0 && n <= 6) {
        dowIndex = Math.round(n);
      }
    }

    let hourOfDay: number | null = parsedDT.hour;
    if (hourOfDay === null && mapping.hourOfDay && row[mapping.hourOfDay] !== null && row[mapping.hourOfDay] !== undefined) {
      const h = Number(row[mapping.hourOfDay]);
      if (!Number.isNaN(h) && h >= 0 && h <= 23) {
        hourOfDay = Math.round(h);
      }
    }

    const dayOfWeekName = dowIndex !== null ? DAY_NAMES[dowIndex] : null;
    const isWeekend = dowIndex !== null ? dowIndex === 0 || dowIndex === 6 : null;

    const reorderedVal =
      mapping.reordered && row[mapping.reordered] !== null && row[mapping.reordered] !== undefined
        ? Number(row[mapping.reordered]) === 1
          ? 1
          : 0
        : null;

    const daysSincePriorVal =
      mapping.daysSincePrior &&
      row[mapping.daysSincePrior] !== null &&
      row[mapping.daysSincePrior] !== undefined &&
      !Number.isNaN(Number(row[mapping.daysSincePrior]))
        ? Number(row[mapping.daysSincePrior])
        : null;

    const cleaned: CleanedTransaction = {
      rowIndex: i + 1,
      transactionId: txId,
      customerId,
      rawProductName: rawProductStr,
      productName: stdResult.standardized,
      category: taxonomy.category,
      subcategory: taxonomy.subcategory,
      tags: taxonomy.tags,
      quantity: safeQty,
      unitPrice: safeUnitPrice,
      revenue,
      purchaseDate: parsedDT.dateStr,
      purchaseTime: parsedDT.timeStr,
      dayOfWeekIndex: dowIndex,
      dayOfWeekName,
      hourOfDay,
      isWeekend,
      reordered: reorderedVal,
      daysSincePrior: daysSincePriorVal,
      wasStandardized: stdResult.changed,
      wasAutoTagged: taxonomy.wasAutoTagged,
    };

    cleanedTransactions.push(cleaned);

    cleanedPreviewRows.push({
      Transaction_ID: cleaned.transactionId,
      Customer_ID: cleaned.customerId ?? 'Guest',
      Product: cleaned.productName,
      Category: cleaned.category,
      Subcategory: cleaned.subcategory,
      Tags: cleaned.tags.join(', '),
      Quantity: cleaned.quantity,
      ...(cleaned.unitPrice !== null ? { Unit_Price: cleaned.unitPrice } : {}),
      ...(cleaned.revenue !== null ? { Line_Revenue: cleaned.revenue } : {}),
      ...(cleaned.purchaseDate ? { Purchase_Date: cleaned.purchaseDate } : {}),
      ...(cleaned.dayOfWeekName ? { Day_Of_Week: cleaned.dayOfWeekName } : {}),
      ...(cleaned.hourOfDay !== null ? { Hour: cleaned.hourOfDay } : {}),
      ...(cleaned.reordered !== null ? { Reordered: cleaned.reordered } : {}),
    });
  }

  const cleanedColumns = cleanedPreviewRows[0] ? Object.keys(cleanedPreviewRows[0]) : [];
  const columnProfilesAfter = profileColumns(cleanedPreviewRows, cleanedColumns);
  const cleanedMissingCells = columnProfilesAfter.reduce((sum, c) => sum + c.missingCount, 0);

  const totalCleanedRows = cleanedTransactions.length;
  const removedRows = totalRawRows - totalCleanedRows;
  const validRowsPct = totalRawRows > 0 ? Number(((totalCleanedRows / totalRawRows) * 100).toFixed(1)) : 0;

  // Transparent, deterministic Data Quality Score formula:
  // 40% Completeness (non-missing cells) + 35% Validity (non-cancelled, valid price/qty/product) + 25% Uniqueness (non-duplicate)
  const rawTotalCells = Math.max(1, totalRawRows * Math.max(1, columns.length));
  const rawCompleteness = Math.max(0, 1 - rawMissingCells / rawTotalCells);
  const rawInvalidTotal = cancelledRowsFound + invalidQuantityRowsFound + invalidPriceRowsFound + missingProductRowsFound;
  const rawValidity = totalRawRows > 0 ? Math.max(0, 1 - rawInvalidTotal / totalRawRows) : 1;
  const rawUniqueness = totalRawRows > 0 ? Math.max(0, 1 - duplicateRowsFound / totalRawRows) : 1;
  const qualityScoreBefore = Number(((rawCompleteness * 40 + rawValidity * 35 + rawUniqueness * 25)).toFixed(1));

  const cleanTotalCells = Math.max(1, totalCleanedRows * Math.max(1, cleanedColumns.length));
  const cleanCompleteness = Math.max(0, 1 - cleanedMissingCells / cleanTotalCells);
  const remainingInvalid =
    (config.removeCancelledInvoices ? 0 : cancelledRowsFound) +
    (config.removeInvalidQuantities ? 0 : invalidQuantityRowsFound) +
    (config.removeInvalidPrices ? 0 : invalidPriceRowsFound) +
    (config.removeMissingProducts ? 0 : missingProductRowsFound);
  const cleanValidity = totalCleanedRows > 0 ? Math.max(0, 1 - remainingInvalid / totalCleanedRows) : 1;
  const remainingDupes = config.removeDuplicates ? 0 : duplicateRowsFound;
  const cleanUniqueness = totalCleanedRows > 0 ? Math.max(0, 1 - remainingDupes / totalCleanedRows) : 1;
  const qualityScoreAfter = Number(((cleanCompleteness * 40 + cleanValidity * 35 + cleanUniqueness * 25)).toFixed(1));

  const cleaningLog: CleaningActionLog[] = [
    {
      id: 'cancelled',
      action: 'Cancelled & Negative-Return Filtering',
      field: mapping.transactionId || 'Invoice/Qty',
      affectedRows: cancelledRemoved,
      status: !mapping.transactionId && !mapping.quantity ? 'not_applicable' : config.removeCancelledInvoices ? 'applied' : 'skipped',
      detail: `${cancelledRowsFound} cancelled/negative-quantity rows detected; ${cancelledRemoved} excluded from active sales metrics.`,
    },
    {
      id: 'invalid_qty',
      action: 'Invalid Quantity Validation (<= 0)',
      field: mapping.quantity || 'Quantity',
      affectedRows: invalidQtyRemoved,
      status: !mapping.quantity ? 'not_applicable' : config.removeInvalidQuantities ? 'applied' : 'skipped',
      detail: `${invalidQuantityRowsFound} rows with non-positive or NaN quantity detected; ${invalidQtyRemoved} removed.`,
    },
    {
      id: 'invalid_price',
      action: 'Unit Price Validation (<= 0 or Null)',
      field: mapping.unitPrice || 'UnitPrice',
      affectedRows: invalidPriceRemoved,
      status: !capabilities.hasPrice ? 'not_applicable' : config.removeInvalidPrices ? 'applied' : 'skipped',
      detail: capabilities.hasPrice
        ? `${invalidPriceRowsFound} rows with zero/negative/missing price detected; ${invalidPriceRemoved} removed.`
        : 'Dataset has no unit price column; step not applicable.',
    },
    {
      id: 'missing_prod',
      action: 'Missing Product Description Removal',
      field: mapping.productName || 'Product',
      affectedRows: missingProductRemoved,
      status: !mapping.productName ? 'not_applicable' : config.removeMissingProducts ? 'applied' : 'skipped',
      detail: `${missingProductRowsFound} rows missing product names detected; ${missingProductRemoved} removed.`,
    },
    {
      id: 'missing_cust',
      action: 'Missing Customer Identifier Handling',
      field: mapping.customerId || 'CustomerID',
      affectedRows: missingCustomerRemoved,
      status: !capabilities.hasCustomerId ? 'not_applicable' : config.removeMissingCustomers ? 'applied' : 'skipped',
      detail: `${missingCustomerRowsFound} rows missing Customer ID (${config.removeMissingCustomers ? 'removed' : 'retained as Guest for basket analytics'}).`,
    },
    {
      id: 'duplicates',
      action: 'Exact Duplicate Line Deduplication',
      field: 'Composite Transaction Key',
      affectedRows: duplicatesRemoved,
      status: config.removeDuplicates ? 'applied' : 'skipped',
      detail: `${duplicateRowsFound} duplicate line items detected; ${duplicatesRemoved} removed.`,
    },
    {
      id: 'standardize',
      action: 'Product Name Standardization',
      field: mapping.productName || 'Product',
      affectedRows: standardizedProductCount,
      status: config.standardizeProductNames ? 'applied' : 'skipped',
      detail: `${standardizedProductCount} product strings normalized (trimmed whitespace, fixed typos/casing, unified units).`,
    },
    {
      id: 'tagging',
      action: 'Product Tagging & Taxonomy Mapping',
      field: 'Category / Subcategory',
      affectedRows: autoTaggedCategoryCount,
      status: config.autoTagCategories ? 'applied' : 'skipped',
      detail: `${autoTaggedCategoryCount} records enriched with Category, Subcategory, and merchandising tags.`,
    },
  ];

  return {
    cleanedTransactions,
    cleanedPreviewRows,
    qualityReport: {
      totalRawRows,
      totalCleanedRows,
      removedRows,
      validRowsPct,
      rawMissingCells,
      cleanedMissingCells,
      duplicateRowsFound,
      cancelledRowsFound,
      invalidQuantityRowsFound,
      invalidPriceRowsFound,
      missingProductRowsFound,
      missingCustomerRowsFound,
      standardizedProductCount,
      autoTaggedCategoryCount,
      qualityScoreBefore,
      qualityScoreAfter,
      qualityFormulaNote:
        'Score = 40% Cell Completeness + 35% Record Validity (non-cancelled, positive qty/price, named product) + 25% Uniqueness (non-duplicate).',
      columnProfilesBefore,
      columnProfilesAfter,
      cleaningLog,
    },
  };
}
