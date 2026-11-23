import {
  BasketAnalyticsResult,
  BasketSummary,
  CategoryMetric,
  CleanedTransaction,
  CustomerRFM,
  CustomerSegment,
  DatasetCapabilities,
  ProductMetric,
  ShoppingPatternsResult,
} from '../types/analytics';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const sq = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  return Math.sqrt(sq / values.length);
}

export function computeBasketAnalytics(
  transactions: CleanedTransaction[],
  capabilities: DatasetCapabilities
): BasketAnalyticsResult {
  const basketMap = new Map<
    string,
    {
      transactionId: string;
      customerId: string | null;
      purchaseDate: string | null;
      dayOfWeekName: string | null;
      hourOfDay: number | null;
      isWeekend: boolean | null;
      itemCount: number;
      products: Set<string>;
      categories: Set<string>;
      basketValue: number;
      hasValue: boolean;
    }
  >();

  let totalItemsSold = 0;
  let totalRevenueAcc = 0;

  for (const tx of transactions) {
    totalItemsSold += tx.quantity;
    if (tx.revenue !== null) totalRevenueAcc += tx.revenue;

    if (!basketMap.has(tx.transactionId)) {
      basketMap.set(tx.transactionId, {
        transactionId: tx.transactionId,
        customerId: tx.customerId,
        purchaseDate: tx.purchaseDate,
        dayOfWeekName: tx.dayOfWeekName,
        hourOfDay: tx.hourOfDay,
        isWeekend: tx.isWeekend,
        itemCount: 0,
        products: new Set(),
        categories: new Set(),
        basketValue: 0,
        hasValue: capabilities.hasRevenue,
      });
    }

    const b = basketMap.get(tx.transactionId)!;
    b.itemCount += tx.quantity;
    b.products.add(tx.productName);
    b.categories.add(tx.category);
    if (tx.revenue !== null) {
      b.basketValue += tx.revenue;
    }
  }

  const baskets: BasketSummary[] = Array.from(basketMap.values()).map((b) => ({
    transactionId: b.transactionId,
    customerId: b.customerId,
    purchaseDate: b.purchaseDate,
    dayOfWeekName: b.dayOfWeekName,
    hourOfDay: b.hourOfDay,
    isWeekend: b.isWeekend,
    itemCount: b.itemCount,
    uniqueProductCount: b.products.size,
    basketValue: capabilities.hasRevenue ? Number(b.basketValue.toFixed(2)) : null,
    categories: Array.from(b.categories),
    products: Array.from(b.products),
  }));

  const sizes = baskets.map((b) => b.itemCount);
  const avgBasketSize = sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;
  const medianBasketSize = median(sizes);
  const minBasketSize = sizes.length > 0 ? Math.min(...sizes) : 0;
  const maxBasketSize = sizes.length > 0 ? Math.max(...sizes) : 0;

  let avgBasketValue: number | null = null;
  let medianBasketValue: number | null = null;
  let minBasketValue: number | null = null;
  let maxBasketValue: number | null = null;
  let stdBasketValue: number | null = null;

  if (capabilities.hasRevenue && baskets.length > 0) {
    const vals = baskets.map((b) => b.basketValue ?? 0);
    avgBasketValue = vals.reduce((a, b) => a + b, 0) / vals.length;
    medianBasketValue = median(vals);
    minBasketValue = Math.min(...vals);
    maxBasketValue = Math.max(...vals);
    stdBasketValue = stdDev(vals, avgBasketValue);
  }

  return {
    totalBaskets: baskets.length,
    avgBasketValue: avgBasketValue !== null ? Number(avgBasketValue.toFixed(2)) : null,
    medianBasketValue: medianBasketValue !== null ? Number(medianBasketValue.toFixed(2)) : null,
    minBasketValue: minBasketValue !== null ? Number(minBasketValue.toFixed(2)) : null,
    maxBasketValue: maxBasketValue !== null ? Number(maxBasketValue.toFixed(2)) : null,
    stdBasketValue: stdBasketValue !== null ? Number(stdBasketValue.toFixed(2)) : null,
    avgBasketSize: Number(avgBasketSize.toFixed(2)),
    medianBasketSize: Number(medianBasketSize.toFixed(1)),
    minBasketSize,
    maxBasketSize,
    totalItemsSold,
    totalRevenue: capabilities.hasRevenue ? Number(totalRevenueAcc.toFixed(2)) : null,
    baskets,
  };
}

export function computeCategoryAnalytics(
  transactions: CleanedTransaction[],
  capabilities: DatasetCapabilities
): CategoryMetric[] {
  // Determine date midpoint for category growth if dates exist
  let midpointDate: string | null = null;
  if (capabilities.hasDate) {
    const dates = transactions
      .map((t) => t.purchaseDate)
      .filter((d): d is string => Boolean(d))
      .sort();
    if (dates.length >= 10) {
      midpointDate = dates[Math.floor(dates.length / 2)];
    }
  }

  const catMap = new Map<
    string,
    {
      revenue: number;
      quantity: number;
      txIds: Set<string>;
      products: Set<string>;
      firstHalfVal: number;
      secondHalfVal: number;
      subcategories: Map<string, { revenue: number; quantity: number; txIds: Set<string> }>;
    }
  >();

  let grandTotalRevenue = 0;
  let grandTotalQty = 0;

  for (const tx of transactions) {
    grandTotalQty += tx.quantity;
    if (tx.revenue !== null) grandTotalRevenue += tx.revenue;

    if (!catMap.has(tx.category)) {
      catMap.set(tx.category, {
        revenue: 0,
        quantity: 0,
        txIds: new Set(),
        products: new Set(),
        firstHalfVal: 0,
        secondHalfVal: 0,
        subcategories: new Map(),
      });
    }

    const c = catMap.get(tx.category)!;
    c.quantity += tx.quantity;
    c.revenue += tx.revenue ?? 0;
    c.txIds.add(tx.transactionId);
    c.products.add(tx.productName);

    if (midpointDate && tx.purchaseDate) {
      const val = capabilities.hasRevenue ? (tx.revenue ?? 0) : tx.quantity;
      if (tx.purchaseDate <= midpointDate) c.firstHalfVal += val;
      else c.secondHalfVal += val;
    }

    if (!c.subcategories.has(tx.subcategory)) {
      c.subcategories.set(tx.subcategory, { revenue: 0, quantity: 0, txIds: new Set() });
    }
    const sub = c.subcategories.get(tx.subcategory)!;
    sub.quantity += tx.quantity;
    sub.revenue += tx.revenue ?? 0;
    sub.txIds.add(tx.transactionId);
  }

  const results: CategoryMetric[] = Array.from(catMap.entries()).map(([category, data]) => {
    let growthPct: number | null = null;
    if (midpointDate && data.firstHalfVal > 0) {
      growthPct = Number((((data.secondHalfVal - data.firstHalfVal) / data.firstHalfVal) * 100).toFixed(1));
    }

    return {
      category,
      subcategories: Array.from(data.subcategories.entries())
        .map(([name, s]) => ({
          name,
          revenue: capabilities.hasRevenue ? Number(s.revenue.toFixed(2)) : null,
          quantity: s.quantity,
          transactions: s.txIds.size,
        }))
        .sort((a, b) => (capabilities.hasRevenue ? (b.revenue ?? 0) - (a.revenue ?? 0) : b.quantity - a.quantity)),
      revenue: capabilities.hasRevenue ? Number(data.revenue.toFixed(2)) : null,
      revenueSharePct:
        capabilities.hasRevenue && grandTotalRevenue > 0
          ? Number(((data.revenue / grandTotalRevenue) * 100).toFixed(1))
          : null,
      quantity: data.quantity,
      quantitySharePct: grandTotalQty > 0 ? Number(((data.quantity / grandTotalQty) * 100).toFixed(1)) : 0,
      transactionCount: data.txIds.size,
      avgBasketContribution:
        capabilities.hasRevenue && data.txIds.size > 0
          ? Number((data.revenue / data.txIds.size).toFixed(2))
          : null,
      uniqueProducts: data.products.size,
      growthPct,
    };
  });

  return results.sort((a, b) =>
    capabilities.hasRevenue ? (b.revenue ?? 0) - (a.revenue ?? 0) : b.quantity - a.quantity
  );
}

export function computeProductAnalytics(
  transactions: CleanedTransaction[],
  capabilities: DatasetCapabilities,
  totalBaskets: number
): ProductMetric[] {
  let midpointDate: string | null = null;
  if (capabilities.hasDate) {
    const dates = transactions
      .map((t) => t.purchaseDate)
      .filter((d): d is string => Boolean(d))
      .sort();
    if (dates.length >= 10) {
      midpointDate = dates[Math.floor(dates.length / 2)];
    }
  }

  const prodMap = new Map<
    string,
    {
      category: string;
      subcategory: string;
      tags: Set<string>;
      revenue: number;
      quantity: number;
      txIds: Set<string>;
      prices: number[];
      reorders: number;
      reorderTotal: number;
      firstHalf: number;
      secondHalf: number;
    }
  >();

  let grandTotalRevenue = 0;
  let grandTotalQty = 0;

  for (const tx of transactions) {
    grandTotalQty += tx.quantity;
    if (tx.revenue !== null) grandTotalRevenue += tx.revenue;

    if (!prodMap.has(tx.productName)) {
      prodMap.set(tx.productName, {
        category: tx.category,
        subcategory: tx.subcategory,
        tags: new Set(tx.tags),
        revenue: 0,
        quantity: 0,
        txIds: new Set(),
        prices: [],
        reorders: 0,
        reorderTotal: 0,
        firstHalf: 0,
        secondHalf: 0,
      });
    }

    const p = prodMap.get(tx.productName)!;
    p.quantity += tx.quantity;
    p.revenue += tx.revenue ?? 0;
    p.txIds.add(tx.transactionId);
    tx.tags.forEach((t) => p.tags.add(t));
    if (tx.unitPrice !== null) p.prices.push(tx.unitPrice);
    if (tx.reordered !== null) {
      p.reorderTotal += 1;
      if (tx.reordered === 1) p.reorders += 1;
    }

    if (midpointDate && tx.purchaseDate) {
      const metric = capabilities.hasRevenue ? (tx.revenue ?? 0) : tx.quantity;
      if (tx.purchaseDate <= midpointDate) p.firstHalf += metric;
      else p.secondHalf += metric;
    }
  }

  const rawList = Array.from(prodMap.entries()).map(([productName, p]) => {
    let growthPct: number | null = null;
    if (midpointDate && p.firstHalf > 0) {
      growthPct = Number((((p.secondHalf - p.firstHalf) / p.firstHalf) * 100).toFixed(1));
    }

    return {
      productName,
      category: p.category,
      subcategory: p.subcategory,
      tags: Array.from(p.tags),
      totalRevenue: capabilities.hasRevenue ? Number(p.revenue.toFixed(2)) : null,
      revenueSharePct:
        capabilities.hasRevenue && grandTotalRevenue > 0
          ? Number(((p.revenue / grandTotalRevenue) * 100).toFixed(2))
          : null,
      totalQuantity: p.quantity,
      quantitySharePct: grandTotalQty > 0 ? Number(((p.quantity / grandTotalQty) * 100).toFixed(2)) : 0,
      transactionCount: p.txIds.size,
      basketPenetrationPct:
        totalBaskets > 0 ? Number(((p.txIds.size / totalBaskets) * 100).toFixed(1)) : 0,
      avgUnitPrice:
        p.prices.length > 0
          ? Number((p.prices.reduce((a, b) => a + b, 0) / p.prices.length).toFixed(2))
          : null,
      reorderRatePct:
        p.reorderTotal > 0 ? Number(((p.reorders / p.reorderTotal) * 100).toFixed(1)) : null,
      growthPct,
    };
  });

  // Sort by revenue when available, else transaction frequency / quantity
  rawList.sort((a, b) =>
    capabilities.hasRevenue
      ? (b.totalRevenue ?? 0) - (a.totalRevenue ?? 0)
      : b.transactionCount - a.transactionCount
  );

  // Assign velocity tier using rank percentiles
  const n = rawList.length;
  return rawList.map((item, idx) => {
    const pctRank = n > 1 ? idx / (n - 1) : 0;
    const velocityTier =
      pctRank <= 0.28 ? 'Fast-Moving' : pctRank <= 0.72 ? 'Steady' : 'Slow-Moving';
    return {
      ...item,
      velocityTier,
      rank: idx + 1,
    };
  });
}

export function computeShoppingPatterns(
  transactions: CleanedTransaction[],
  baskets: BasketSummary[],
  capabilities: DatasetCapabilities
): ShoppingPatternsResult {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayAgg = dayNames.map((dayName, dayIndex) => ({
    dayIndex,
    dayName,
    orders: 0,
    items: 0,
    revenue: 0,
    isWeekend: dayIndex === 0 || dayIndex === 6,
  }));

  const hourAgg = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    orders: 0,
    items: 0,
    revenue: 0,
  }));

  const matrixOrders: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const matrixRev: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  // Map transactionId -> dayIndex & hour
  const txTimeMap = new Map<string, { dow: number | null; hour: number | null }>();
  for (const tx of transactions) {
    if (!txTimeMap.has(tx.transactionId)) {
      txTimeMap.set(tx.transactionId, { dow: tx.dayOfWeekIndex, hour: tx.hourOfDay });
    }
    if (tx.dayOfWeekIndex !== null) {
      dayAgg[tx.dayOfWeekIndex].items += tx.quantity;
      dayAgg[tx.dayOfWeekIndex].revenue += tx.revenue ?? 0;
    }
    if (tx.hourOfDay !== null) {
      hourAgg[tx.hourOfDay].items += tx.quantity;
      hourAgg[tx.hourOfDay].revenue += tx.revenue ?? 0;
    }
    if (tx.dayOfWeekIndex !== null && tx.hourOfDay !== null) {
      matrixRev[tx.dayOfWeekIndex][tx.hourOfDay] += tx.revenue ?? 0;
    }
  }

  let weekdayOrders = 0;
  let weekendOrders = 0;
  let weekdayItems = 0;
  let weekendItems = 0;
  let weekdayRev = 0;
  let weekendRev = 0;

  for (const b of baskets) {
    const info = txTimeMap.get(b.transactionId);
    const dow = info?.dow ?? null;
    const hour = info?.hour ?? null;

    if (dow !== null) {
      dayAgg[dow].orders += 1;
      if (dow === 0 || dow === 6) {
        weekendOrders += 1;
        weekendItems += b.itemCount;
        weekendRev += b.basketValue ?? 0;
      } else {
        weekdayOrders += 1;
        weekdayItems += b.itemCount;
        weekdayRev += b.basketValue ?? 0;
      }
    }
    if (hour !== null) {
      hourAgg[hour].orders += 1;
    }
    if (dow !== null && hour !== null) {
      matrixOrders[dow][hour] += 1;
    }
  }

  const totalRev = weekdayRev + weekendRev;

  return {
    byDay: dayAgg.map((d) => ({
      dayIndex: d.dayIndex,
      dayName: d.dayName,
      orders: d.orders,
      items: d.items,
      revenue: capabilities.hasRevenue ? Number(d.revenue.toFixed(2)) : null,
      isWeekend: d.isWeekend,
    })),
    byHour: hourAgg.map((h) => ({
      hour: h.hour,
      label: h.label,
      orders: h.orders,
      items: h.items,
      revenue: capabilities.hasRevenue ? Number(h.revenue.toFixed(2)) : null,
    })),
    weekdayVsWeekend: {
      weekdayOrders,
      weekendOrders,
      weekdayAvgSize: weekdayOrders > 0 ? Number((weekdayItems / weekdayOrders).toFixed(2)) : 0,
      weekendAvgSize: weekendOrders > 0 ? Number((weekendItems / weekendOrders).toFixed(2)) : 0,
      weekdayAvgValue:
        capabilities.hasRevenue && weekdayOrders > 0
          ? Number((weekdayRev / weekdayOrders).toFixed(2))
          : null,
      weekendAvgValue:
        capabilities.hasRevenue && weekendOrders > 0
          ? Number((weekendRev / weekendOrders).toFixed(2))
          : null,
      weekdayRevenueSharePct:
        capabilities.hasRevenue && totalRev > 0 ? Number(((weekdayRev / totalRev) * 100).toFixed(1)) : null,
      weekendRevenueSharePct:
        capabilities.hasRevenue && totalRev > 0 ? Number(((weekendRev / totalRev) * 100).toFixed(1)) : null,
    },
    heatmapMatrix: {
      days: dayNames,
      hours: Array.from({ length: 24 }, (_, i) => i),
      zOrders: matrixOrders,
      zRevenue: capabilities.hasRevenue
        ? matrixRev.map((row) => row.map((v) => Number(v.toFixed(2))))
        : matrixRev.map((row) => row.map(() => null)),
    },
  };
}

function assignQuintileScores(values: number[], ascendingIsBetter: boolean): number[] {
  if (values.length === 0) return [];
  const indexed = values.map((v, idx) => ({ v, idx })).sort((a, b) => a.v - b.v);
  const scores = new Array<number>(values.length).fill(3);
  const n = indexed.length;
  indexed.forEach((item, rank) => {
    const q = Math.min(5, Math.max(1, Math.ceil(((rank + 1) / n) * 5)));
    scores[item.idx] = ascendingIsBetter ? q : 6 - q;
  });
  return scores;
}

export function computeCustomerRFM(
  transactions: CleanedTransaction[],
  capabilities: DatasetCapabilities
): CustomerRFM[] {
  if (!capabilities.hasCustomerId) return [];

  // Determine reference max date if dates exist
  const allDates = transactions
    .map((t) => t.purchaseDate)
    .filter((d): d is string => Boolean(d))
    .sort();
  const maxDateMs = allDates.length > 0 ? new Date(`${allDates[allDates.length - 1]}T00:00:00`).getTime() : null;

  const custMap = new Map<
    string,
    {
      txIds: Set<string>;
      totalSpend: number;
      totalItems: number;
      lastDate: string | null;
      daysPriorList: number[];
      catCount: Map<string, number>;
    }
  >();

  for (const tx of transactions) {
    if (!tx.customerId) continue;
    if (!custMap.has(tx.customerId)) {
      custMap.set(tx.customerId, {
        txIds: new Set(),
        totalSpend: 0,
        totalItems: 0,
        lastDate: null,
        daysPriorList: [],
        catCount: new Map(),
      });
    }
    const c = custMap.get(tx.customerId)!;
    c.txIds.add(tx.transactionId);
    c.totalSpend += tx.revenue ?? 0;
    c.totalItems += tx.quantity;
    if (tx.purchaseDate && (!c.lastDate || tx.purchaseDate > c.lastDate)) {
      c.lastDate = tx.purchaseDate;
    }
    if (tx.daysSincePrior !== null) {
      c.daysPriorList.push(tx.daysSincePrior);
    }
    c.catCount.set(tx.category, (c.catCount.get(tx.category) ?? 0) + tx.quantity);
  }

  const rawCustomers = Array.from(custMap.entries()).map(([customerId, c]) => {
    let recencyValue = 0;
    let recencyLabel = 'N/A';

    if (maxDateMs !== null && c.lastDate) {
      const lastMs = new Date(`${c.lastDate}T00:00:00`).getTime();
      recencyValue = Math.max(0, Math.round((maxDateMs - lastMs) / (1000 * 60 * 60 * 24)));
      recencyLabel = `${recencyValue} days ago`;
    } else if (c.daysPriorList.length > 0) {
      recencyValue = Number(
        (c.daysPriorList.reduce((a, b) => a + b, 0) / c.daysPriorList.length).toFixed(1)
      );
      recencyLabel = `${recencyValue}d avg interval`;
    } else {
      recencyValue = 1;
      recencyLabel = 'Single-window';
    }

    let favCat = 'General';
    let maxCatQty = -1;
    c.catCount.forEach((qty, cat) => {
      if (qty > maxCatQty) {
        maxCatQty = qty;
        favCat = cat;
      }
    });

    const freq = c.txIds.size;
    return {
      customerId,
      recencyValue,
      recencyLabel,
      frequency: freq,
      monetary: capabilities.hasRevenue ? Number(c.totalSpend.toFixed(2)) : null,
      avgBasketValue:
        capabilities.hasRevenue && freq > 0 ? Number((c.totalSpend / freq).toFixed(2)) : null,
      avgBasketSize: freq > 0 ? Number((c.totalItems / freq).toFixed(1)) : 0,
      favoriteCategory: favCat,
      lastPurchaseDate: c.lastDate,
    };
  });

  if (rawCustomers.length === 0) return [];

  // Smaller recency days = better (ascendingIsBetter = false)
  const rScores = assignQuintileScores(
    rawCustomers.map((c) => c.recencyValue),
    false
  );
  const fScores = assignQuintileScores(
    rawCustomers.map((c) => c.frequency),
    true
  );
  const mScores = capabilities.hasRevenue
    ? assignQuintileScores(
        rawCustomers.map((c) => c.monetary ?? 0),
        true
      )
    : null;

  return rawCustomers
    .map((c, idx) => {
      const r = rScores[idx];
      const f = fScores[idx];
      const m = mScores ? mScores[idx] : null;
      const composite = m !== null ? Number(((r + f + m) / 3).toFixed(2)) : Number(((r + f) / 2).toFixed(2));

      let segment: CustomerSegment = 'Regular';
      if (r >= 4 && f >= 4 && (m === null || m >= 4)) {
        segment = 'VIP';
      } else if (f >= 4 || (r >= 4 && f >= 3)) {
        segment = 'Loyal';
      } else if (r <= 2 && f >= 2) {
        segment = 'At-Risk';
      } else if (r === 1 && f === 1) {
        segment = 'Inactive';
      }

      return {
        ...c,
        rScore: r,
        fScore: f,
        mScore: m,
        rfmComposite: composite,
        segment,
      };
    })
    .sort((a, b) =>
      capabilities.hasRevenue ? (b.monetary ?? 0) - (a.monetary ?? 0) : b.frequency - a.frequency
    );
}
