import {
  AnomalyPoint,
  AssociationRule,
  CleanedTransaction,
  CorrelogramData,
  DatasetCapabilities,
  ForecastPoint,
  ForecastResult,
  NetworkEdge,
  NetworkNode,
  OpportunityPoint,
  OpportunityQuadrant,
  ProductMetric,
  SalesTimePoint,
} from '../types/analytics';

function getWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const monday = new Date(d.setDate(diff));
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const dt = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

export function computeSalesTrends(
  transactions: CleanedTransaction[],
  capabilities: DatasetCapabilities,
  granularity: 'daily' | 'weekly' | 'monthly'
): SalesTimePoint[] {
  if (!capabilities.hasDate) return [];

  const buckets = new Map<
    string,
    { revenue: number; quantity: number; txIds: Set<string> }
  >();

  for (const tx of transactions) {
    if (!tx.purchaseDate) continue;
    let key = tx.purchaseDate;
    if (granularity === 'weekly') key = getWeekKey(tx.purchaseDate);
    else if (granularity === 'monthly') key = tx.purchaseDate.slice(0, 7);

    if (!buckets.has(key)) {
      buckets.set(key, { revenue: 0, quantity: 0, txIds: new Set() });
    }
    const b = buckets.get(key)!;
    b.revenue += tx.revenue ?? 0;
    b.quantity += tx.quantity;
    b.txIds.add(tx.transactionId);
  }

  const sortedKeys = Array.from(buckets.keys()).sort();
  return sortedKeys.map((key, idx) => {
    const cur = buckets.get(key)!;
    const prev = idx > 0 ? buckets.get(sortedKeys[idx - 1])! : null;
    const curVal = capabilities.hasRevenue ? cur.revenue : cur.quantity;
    const prevVal = prev ? (capabilities.hasRevenue ? prev.revenue : prev.quantity) : null;
    const growthPct =
      prevVal !== null && prevVal > 0
        ? Number((((curVal - prevVal) / prevVal) * 100).toFixed(1))
        : null;

    return {
      period: key,
      label: key,
      revenue: capabilities.hasRevenue ? Number(cur.revenue.toFixed(2)) : null,
      quantity: cur.quantity,
      transactions: cur.txIds.size,
      avgBasketValue:
        capabilities.hasRevenue && cur.txIds.size > 0
          ? Number((cur.revenue / cur.txIds.size).toFixed(2))
          : null,
      growthPct,
    };
  });
}

export function computeSalesForecast(
  transactions: CleanedTransaction[],
  capabilities: DatasetCapabilities,
  granularity: 'weekly' | 'monthly',
  horizonPeriods: number,
  modelType: 'holt' | 'linear' = 'holt'
): ForecastResult {
  if (!capabilities.hasDate) {
    return {
      supported: false,
      unsupportedReason:
        'Calendar purchase dates are not present in this dataset (e.g. Instacart only records relative day-of-week). Time-series forecasting requires genuine calendar timestamps.',
      granularity,
      modelName: 'Unavailable',
      modelDescription: 'Requires calendar date column.',
      horizonPeriods,
      mapePct: 0,
      rmse: 0,
      rSquared: 0,
      trendSlopePerPeriod: 0,
      points: [],
    };
  }

  const series = computeSalesTrends(transactions, capabilities, granularity);
  if (series.length < 4) {
    return {
      supported: false,
      unsupportedReason: `Only ${series.length} ${granularity} periods found. At least 4 historical periods are required to fit a reliable trend forecast.`,
      granularity,
      modelName: 'Insufficient History',
      modelDescription: 'Need at least 4 time periods.',
      horizonPeriods,
      mapePct: 0,
      rmse: 0,
      rSquared: 0,
      trendSlopePerPeriod: 0,
      points: [],
    };
  }

  const y = series.map((s) => (capabilities.hasRevenue ? (s.revenue ?? 0) : s.quantity));
  const n = y.length;

  // Exclude partial trailing week/month if it is < 45% of previous median to prevent artificial cliff drop
  const medianVal = [...y].sort((a, b) => a - b)[Math.floor(n / 2)];
  const trimmedSeries =
    n >= 5 && y[n - 1] < medianVal * 0.4 ? series.slice(0, n - 1) : series;
  const values = trimmedSeries.map((s) => (capabilities.hasRevenue ? (s.revenue ?? 0) : s.quantity));
  const m = values.length;

  let fitted: number[] = [];
  let forecastVals: number[] = [];
  let slope = 0;

  if (modelType === 'holt') {
    // Holt's Linear Trend Double Exponential Smoothing (alpha=0.35, beta=0.15)
    const alpha = 0.35;
    const beta = 0.15;
    let level = values[0];
    let trend = m > 1 ? values[1] - values[0] : 0;

    fitted = [level];
    for (let t = 1; t < m; t++) {
      const forecastStep = level + trend;
      fitted.push(Math.max(0, forecastStep));
      const prevLevel = level;
      level = alpha * values[t] + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }
    slope = trend;
    for (let h = 1; h <= horizonPeriods; h++) {
      forecastVals.push(Math.max(0, level + h * trend));
    }
  } else {
    // Ordinary Least Squares Linear Trend
    const meanX = (m - 1) / 2;
    const meanY = values.reduce((a, b) => a + b, 0) / m;
    let num = 0;
    let den = 0;
    for (let i = 0; i < m; i++) {
      num += (i - meanX) * (values[i] - meanY);
      den += (i - meanX) ** 2;
    }
    slope = den > 0 ? num / den : 0;
    const intercept = meanY - slope * meanX;
    fitted = values.map((_, i) => Math.max(0, intercept + slope * i));
    for (let h = 1; h <= horizonPeriods; h++) {
      forecastVals.push(Math.max(0, intercept + slope * (m - 1 + h)));
    }
  }

  // Diagnostics
  const residuals = values.map((v, i) => v - fitted[i]);
  const rmse = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / m);
  const mapeVals = values.map((v, i) => (v > 0 ? Math.abs(residuals[i] / v) * 100 : 0));
  const mapePct = mapeVals.reduce((a, b) => a + b, 0) / m;

  const meanY = values.reduce((a, b) => a + b, 0) / m;
  const ssTot = values.reduce((s, v) => s + (v - meanY) ** 2, 0);
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  const points: ForecastPoint[] = trimmedSeries.map((pt, idx) => ({
    period: pt.period,
    label: pt.label,
    actual: Number(values[idx].toFixed(2)),
    forecast: idx === m - 1 ? Number(values[idx].toFixed(2)) : null,
    lower80: null,
    upper80: null,
    lower95: null,
    upper95: null,
  }));

  const lastDate = new Date(`${trimmedSeries[m - 1].period}${granularity === 'monthly' ? '-01' : ''}T00:00:00`);
  for (let h = 1; h <= horizonPeriods; h++) {
    const nextDate = new Date(lastDate);
    if (granularity === 'weekly') {
      nextDate.setDate(lastDate.getDate() + 7 * h);
    } else {
      nextDate.setMonth(lastDate.getMonth() + h);
    }
    const pStr =
      granularity === 'monthly'
        ? `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
        : `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

    const fVal = forecastVals[h - 1];
    // Expanding prediction interval width with horizon sqrt(h)
    const sigma = rmse * Math.sqrt(1 + (h - 1) * 0.28);
    points.push({
      period: pStr,
      label: pStr,
      actual: null,
      forecast: Number(fVal.toFixed(2)),
      lower80: Number(Math.max(0, fVal - 1.28 * sigma).toFixed(2)),
      upper80: Number((fVal + 1.28 * sigma).toFixed(2)),
      lower95: Number(Math.max(0, fVal - 1.96 * sigma).toFixed(2)),
      upper95: Number((fVal + 1.96 * sigma).toFixed(2)),
    });
  }

  return {
    supported: true,
    granularity,
    modelName:
      modelType === 'holt'
        ? "Holt's Double Exponential Smoothing (α=0.35, β=0.15)"
        : 'Ordinary Least Squares (OLS) Linear Trend',
    modelDescription:
      modelType === 'holt'
        ? 'Captures adaptive level and local trend slope across consecutive periods with expanding prediction intervals.'
        : 'Fits a global least-squares trend line across historical periods with residual-calibrated confidence bands.',
    horizonPeriods,
    mapePct: Number(mapePct.toFixed(1)),
    rmse: Number(rmse.toFixed(2)),
    rSquared: Number(rSquared.toFixed(3)),
    trendSlopePerPeriod: Number(slope.toFixed(2)),
    points,
  };
}

export function computeAnomalies(
  transactions: CleanedTransaction[],
  capabilities: DatasetCapabilities,
  zThreshold = 2.0
): AnomalyPoint[] {
  if (!capabilities.hasDate) return [];

  const daily = computeSalesTrends(transactions, capabilities, 'daily');
  if (daily.length < 7) return [];

  const anomalies: AnomalyPoint[] = [];

  // 1. Daily Revenue or Quantity anomalies using robust rolling window / global Z-score
  const metricValues = daily.map((d) => (capabilities.hasRevenue ? (d.revenue ?? 0) : d.quantity));
  const meanVal = metricValues.reduce((a, b) => a + b, 0) / metricValues.length;
  const stdVal = Math.sqrt(
    metricValues.reduce((s, v) => s + (v - meanVal) ** 2, 0) / metricValues.length
  );

  if (stdVal > 0) {
    daily.forEach((d, idx) => {
      const val = metricValues[idx];
      const z = (val - meanVal) / stdVal;
      if (Math.abs(z) >= zThreshold) {
        const devPct = meanVal > 0 ? ((val - meanVal) / meanVal) * 100 : 0;
        const type = z > 0 ? 'Spike' : 'Drop';
        anomalies.push({
          id: `anom-rev-${d.period}`,
          period: d.period,
          metric: capabilities.hasRevenue ? 'Revenue' : 'Transaction Volume',
          entityName: 'Storewide Daily Sales',
          actualValue: Number(val.toFixed(2)),
          expectedValue: Number(meanVal.toFixed(2)),
          deviationPct: Number(devPct.toFixed(1)),
          zScore: Number(z.toFixed(2)),
          type,
          severity: Math.abs(z) >= 2.8 ? 'High' : 'Moderate',
          explanation: `${type === 'Spike' ? 'Surge' : 'Drop'} of ${devPct > 0 ? '+' : ''}${devPct.toFixed(1)}% (${z > 0 ? '+' : ''}${z.toFixed(2)}σ) relative to daily baseline (${meanVal.toFixed(1)}).`,
        });
      }
    });
  }

  // 2. Daily Transaction Count anomalies (avoid duplicating exact same date if already flagged unless huge)
  const txCounts = daily.map((d) => d.transactions);
  const meanTx = txCounts.reduce((a, b) => a + b, 0) / txCounts.length;
  const stdTx = Math.sqrt(txCounts.reduce((s, v) => s + (v - meanTx) ** 2, 0) / txCounts.length);

  if (stdTx > 0) {
    daily.forEach((d, idx) => {
      const val = txCounts[idx];
      const z = (val - meanTx) / stdTx;
      if (Math.abs(z) >= zThreshold + 0.2) {
        const devPct = meanTx > 0 ? ((val - meanTx) / meanTx) * 100 : 0;
        const type = z > 0 ? 'Spike' : 'Drop';
        anomalies.push({
          id: `anom-tx-${d.period}`,
          period: d.period,
          metric: 'Transaction Volume',
          entityName: 'Daily Basket Count',
          actualValue: val,
          expectedValue: Number(meanTx.toFixed(1)),
          deviationPct: Number(devPct.toFixed(1)),
          zScore: Number(z.toFixed(2)),
          type,
          severity: Math.abs(z) >= 3.0 ? 'High' : 'Moderate',
          explanation: `${val} orders recorded vs ${meanTx.toFixed(1)} daily average (${z > 0 ? '+' : ''}${z.toFixed(2)}σ).`,
        });
      }
    });
  }

  // 3. Product-level weekly demand anomalies
  const prodWeekMap = new Map<string, Map<string, number>>();
  const allWeeks = new Set<string>();
  for (const tx of transactions) {
    if (!tx.purchaseDate) continue;
    const wk = getWeekKey(tx.purchaseDate);
    allWeeks.add(wk);
    if (!prodWeekMap.has(tx.productName)) prodWeekMap.set(tx.productName, new Map());
    const wkMap = prodWeekMap.get(tx.productName)!;
    wkMap.set(wk, (wkMap.get(wk) ?? 0) + tx.quantity);
  }

  const weekList = Array.from(allWeeks).sort();
  if (weekList.length >= 6) {
    prodWeekMap.forEach((wkMap, productName) => {
      const series = weekList.map((w) => wkMap.get(w) ?? 0);
      const meanP = series.reduce((a, b) => a + b, 0) / series.length;
      if (meanP < 2) return; // ignore very sparse products
      const stdP = Math.sqrt(series.reduce((s, v) => s + (v - meanP) ** 2, 0) / series.length);
      if (stdP === 0) return;

      let bestIdx = -1;
      let bestAbsZ = 0;
      series.forEach((v, idx) => {
        const absZ = Math.abs((v - meanP) / stdP);
        if (absZ >= zThreshold + 0.5 && absZ > bestAbsZ) {
          bestAbsZ = absZ;
          bestIdx = idx;
        }
      });

      if (bestIdx !== -1) {
        const actual = series[bestIdx];
        const z = (actual - meanP) / stdP;
        const devPct = ((actual - meanP) / meanP) * 100;
        const type = z > 0 ? 'Spike' : 'Drop';
        anomalies.push({
          id: `anom-prod-${productName}-${weekList[bestIdx]}`,
          period: weekList[bestIdx],
          metric: 'Product Demand',
          entityName: productName,
          actualValue: actual,
          expectedValue: Number(meanP.toFixed(1)),
          deviationPct: Number(devPct.toFixed(1)),
          zScore: Number(z.toFixed(2)),
          type,
          severity: Math.abs(z) >= 3.0 ? 'High' : 'Moderate',
          explanation: `Weekly demand of ${actual} units vs ${meanP.toFixed(1)} avg weekly units (${z > 0 ? '+' : ''}${z.toFixed(2)}σ).`,
        });
      }
    });
  }

  return anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

export function computeMarketBasket(
  transactions: CleanedTransaction[],
  options: {
    minSupport?: number;
    minConfidence?: number;
    minLift?: number;
    maxRules?: number;
  } = {}
): {
  rules: AssociationRule[];
  frequentPairs: { items: [string, string]; count: number; support: number }[];
  frequentTriples: { items: [string, string, string]; count: number; support: number }[];
  totalBaskets: number;
} {
  const minSupport = options.minSupport ?? 0.015;
  const minConfidence = options.minConfidence ?? 0.2;
  const minLift = options.minLift ?? 1.1;
  const maxRules = options.maxRules ?? 80;

  // Group unique products per basket
  const basketItems = new Map<string, Set<string>>();
  for (const tx of transactions) {
    if (!basketItems.has(tx.transactionId)) {
      basketItems.set(tx.transactionId, new Set());
    }
    basketItems.get(tx.transactionId)!.add(tx.productName);
  }

  const baskets = Array.from(basketItems.values()).map((set) => Array.from(set).sort());
  const totalBaskets = baskets.length;
  if (totalBaskets === 0) {
    return { rules: [], frequentPairs: [], frequentTriples: [], totalBaskets: 0 };
  }

  // 1-itemset counts
  const itemCounts = new Map<string, number>();
  for (const b of baskets) {
    for (const item of b) {
      itemCounts.set(item, (itemCounts.get(item) ?? 0) + 1);
    }
  }

  const freq1 = new Set<string>();
  itemCounts.forEach((cnt, item) => {
    if (cnt / totalBaskets >= minSupport) {
      freq1.add(item);
    }
  });

  // 2-itemset counts
  const pairCounts = new Map<string, number>();
  const tripleCounts = new Map<string, number>();

  for (const b of baskets) {
    const filtered = b.filter((item) => freq1.has(item));
    const len = filtered.length;
    for (let i = 0; i < len; i++) {
      for (let j = i + 1; j < len; j++) {
        const pairKey = `${filtered[i]}|||${filtered[j]}`;
        pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
        for (let k = j + 1; k < len; k++) {
          const tripleKey = `${filtered[i]}|||${filtered[j]}|||${filtered[k]}`;
          tripleCounts.set(tripleKey, (tripleCounts.get(tripleKey) ?? 0) + 1);
        }
      }
    }
  }

  const rules: AssociationRule[] = [];
  const frequentPairs: { items: [string, string]; count: number; support: number }[] = [];
  const frequentTriples: { items: [string, string, string]; count: number; support: number }[] = [];

  pairCounts.forEach((count, key) => {
    const support = count / totalBaskets;
    if (support < minSupport) return;
    const [a, b] = key.split('|||');
    frequentPairs.push({ items: [a, b], count, support: Number(support.toFixed(4)) });

    const supA = (itemCounts.get(a) ?? 0) / totalBaskets;
    const supB = (itemCounts.get(b) ?? 0) / totalBaskets;

    // Rule A -> B
    const confAB = supA > 0 ? support / supA : 0;
    const liftAB = supB > 0 ? confAB / supB : 0;
    if (confAB >= minConfidence && liftAB >= minLift) {
      const levAB = support - supA * supB;
      const convAB = confAB < 1 ? (1 - supB) / (1 - confAB) : 99;
      rules.push({
        id: `rule-${a}->${b}`,
        antecedents: [a],
        consequents: [b],
        antecedentLabel: a,
        consequentLabel: b,
        antecedentSupport: Number(supA.toFixed(4)),
        consequentSupport: Number(supB.toFixed(4)),
        support: Number(support.toFixed(4)),
        confidence: Number(confAB.toFixed(4)),
        lift: Number(liftAB.toFixed(3)),
        leverage: Number(levAB.toFixed(4)),
        conviction: Number(Math.min(99, convAB).toFixed(2)),
        coOccurrenceCount: count,
      });
    }

    // Rule B -> A
    const confBA = supB > 0 ? support / supB : 0;
    const liftBA = supA > 0 ? confBA / supA : 0;
    if (confBA >= minConfidence && liftBA >= minLift) {
      const levBA = support - supB * supA;
      const convBA = confBA < 1 ? (1 - supA) / (1 - confBA) : 99;
      rules.push({
        id: `rule-${b}->${a}`,
        antecedents: [b],
        consequents: [a],
        antecedentLabel: b,
        consequentLabel: a,
        antecedentSupport: Number(supB.toFixed(4)),
        consequentSupport: Number(supA.toFixed(4)),
        support: Number(support.toFixed(4)),
        confidence: Number(confBA.toFixed(4)),
        lift: Number(liftBA.toFixed(3)),
        leverage: Number(levBA.toFixed(4)),
        conviction: Number(Math.min(99, convBA).toFixed(2)),
        coOccurrenceCount: count,
      });
    }
  });

  // Also mine strong 2-item -> 1-item rules from frequent triples
  tripleCounts.forEach((count, key) => {
    const support = count / totalBaskets;
    if (support < minSupport) return;
    const [a, b, c] = key.split('|||');
    frequentTriples.push({ items: [a, b, c], count, support: Number(support.toFixed(4)) });

    const combos: [[string, string], string][] = [
      [[a, b], c],
      [[a, c], b],
      [[b, c], a],
    ];
    for (const [ant, con] of combos) {
      const antKey = [...ant].sort().join('|||');
      const antCount = pairCounts.get(antKey) ?? 0;
      const supAnt = antCount / totalBaskets;
      const supCon = (itemCounts.get(con) ?? 0) / totalBaskets;
      if (supAnt <= 0 || supCon <= 0) continue;
      const conf = support / supAnt;
      const lift = conf / supCon;
      if (conf >= minConfidence && lift >= minLift) {
        const lev = support - supAnt * supCon;
        const conv = conf < 1 ? (1 - supCon) / (1 - conf) : 99;
        rules.push({
          id: `rule-${ant.join('+')}->${con}`,
          antecedents: ant,
          consequents: [con],
          antecedentLabel: `${ant[0]} + ${ant[1]}`,
          consequentLabel: con,
          antecedentSupport: Number(supAnt.toFixed(4)),
          consequentSupport: Number(supCon.toFixed(4)),
          support: Number(support.toFixed(4)),
          confidence: Number(conf.toFixed(4)),
          lift: Number(lift.toFixed(3)),
          leverage: Number(lev.toFixed(4)),
          conviction: Number(Math.min(99, conv).toFixed(2)),
          coOccurrenceCount: count,
        });
      }
    }
  });

  rules.sort((x, y) => y.lift - x.lift || y.confidence - x.confidence);
  frequentPairs.sort((x, y) => y.count - x.count);
  frequentTriples.sort((x, y) => y.count - x.count);

  return {
    rules: rules.slice(0, maxRules),
    frequentPairs: frequentPairs.slice(0, 30),
    frequentTriples: frequentTriples.slice(0, 20),
    totalBaskets,
  };
}

export function buildProductNetwork(
  rules: AssociationRule[],
  products: ProductMetric[],
  totalBaskets: number,
  maxEdges = 45
): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  // Use single-item -> single-item rules for clean network edges (deduplicated undirected + strongest direction)
  const pairRules = rules.filter((r) => r.antecedents.length === 1 && r.consequents.length === 1);
  const edgeMap = new Map<string, NetworkEdge>();

  for (const r of pairRules) {
    const a = r.antecedents[0];
    const b = r.consequents[0];
    const key = [a, b].sort().join('|||');
    const existing = edgeMap.get(key);
    if (!existing || r.lift > existing.lift) {
      edgeMap.set(key, {
        id: `${a}--${b}`,
        source: a,
        target: b,
        support: r.support,
        confidence: r.confidence,
        lift: r.lift,
        coOccurrence: r.coOccurrenceCount,
      });
    }
  }

  const edges = Array.from(edgeMap.values())
    .sort((a, b) => b.lift - a.lift || b.support - a.support)
    .slice(0, maxEdges);

  const connectedIds = new Set<string>();
  const degreeMap = new Map<string, number>();
  for (const e of edges) {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
    degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
  }

  const prodLookup = new Map(products.map((p) => [p.productName, p]));
  const nodeIds = Array.from(connectedIds);
  const n = nodeIds.length;
  if (n === 0) return { nodes: [], edges: [] };

  // Deterministic circular init + Fruchterman-Reingold spring force layout
  const width = 900;
  const height = 560;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.36;

  const pos = new Map<string, { x: number; y: number }>();
  nodeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / n;
    pos.set(id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  const area = width * height;
  const k = Math.sqrt(area / Math.max(1, n)) * 0.92;
  const iterations = 90;

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map<string, { dx: number; dy: number }>();
    nodeIds.forEach((id) => disp.set(id, { dx: 0, dy: 0 }));

    // Repulsive forces
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const u = nodeIds[i];
        const v = nodeIds[j];
        const pu = pos.get(u)!;
        const pv = pos.get(v)!;
        let dx = pu.x - pv.x;
        let dy = pu.y - pv.y;
        const dist = Math.max(8, Math.hypot(dx, dy));
        const force = (k * k) / dist;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        disp.get(u)!.dx += dx;
        disp.get(u)!.dy += dy;
        disp.get(v)!.dx -= dx;
        disp.get(v)!.dy -= dy;
      }
    }

    // Attractive forces along edges
    for (const e of edges) {
      const pu = pos.get(e.source)!;
      const pv = pos.get(e.target)!;
      const dx = pu.x - pv.x;
      const dy = pu.y - pv.y;
      const dist = Math.max(8, Math.hypot(dx, dy));
      const force = ((dist * dist) / k) * Math.min(2.2, 0.7 + (e.lift - 1) * 0.25);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      disp.get(e.source)!.dx -= fx;
      disp.get(e.source)!.dy -= fy;
      disp.get(e.target)!.dx += fx;
      disp.get(e.target)!.dy += fy;
    }

    // Gravity toward center + temperature cooling
    const temp = 42 * (1 - iter / iterations) + 2;
    for (const id of nodeIds) {
      const p = pos.get(id)!;
      const d = disp.get(id)!;
      d.dx += (cx - p.x) * 0.08;
      d.dy += (cy - p.y) * 0.08;
      const mag = Math.max(0.01, Math.hypot(d.dx, d.dy));
      p.x += (d.dx / mag) * Math.min(mag, temp);
      p.y += (d.dy / mag) * Math.min(mag, temp);
      p.x = Math.max(70, Math.min(width - 70, p.x));
      p.y = Math.max(55, Math.min(height - 55, p.y));
    }
  }

  const nodes: NetworkNode[] = nodeIds.map((id) => {
    const prod = prodLookup.get(id);
    const p = pos.get(id)!;
    const freq = prod?.transactionCount ?? 0;
    return {
      id,
      label: id,
      category: prod?.category ?? 'General',
      frequency: freq,
      support: totalBaskets > 0 ? Number((freq / totalBaskets).toFixed(4)) : 0,
      revenue: prod?.totalRevenue ?? null,
      degree: degreeMap.get(id) ?? 0,
      x: Number(p.x.toFixed(1)),
      y: Number(p.y.toFixed(1)),
    };
  });

  return { nodes, edges };
}

export function computeCategoryCorrelogram(
  transactions: CleanedTransaction[],
  capabilities: DatasetCapabilities
): CorrelogramData {
  // Build category vector across baskets (or across dates when available for sales-day correlation)
  const catTotals = new Map<string, number>();
  const unitVectors = new Map<string, Map<string, number>>();
  const allKeys = new Set<string>();

  for (const tx of transactions) {
    const groupKey = capabilities.hasDate && tx.purchaseDate ? tx.purchaseDate : tx.transactionId;
    allKeys.add(groupKey);
    const val = capabilities.hasRevenue ? (tx.revenue ?? 0) : tx.quantity;
    catTotals.set(tx.category, (catTotals.get(tx.category) ?? 0) + val);

    if (!unitVectors.has(tx.category)) unitVectors.set(tx.category, new Map());
    const vec = unitVectors.get(tx.category)!;
    vec.set(groupKey, (vec.get(groupKey) ?? 0) + val);
  }

  const categories = Array.from(catTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 9)
    .map(([cat]) => cat);

  const keys = Array.from(allKeys);
  const n = keys.length;
  if (categories.length < 2 || n < 3) {
    return { categories, matrix: [], strongestPositive: null, strongestNegative: null };
  }

  const vectors = categories.map((cat) => {
    const map = unitVectors.get(cat)!;
    return keys.map((k) => map.get(k) ?? 0);
  });

  const means = vectors.map((v) => v.reduce((a, b) => a + b, 0) / n);
  const matrix: number[][] = Array.from({ length: categories.length }, () =>
    Array(categories.length).fill(0)
  );

  let strongestPositive: CorrelogramData['strongestPositive'] = null;
  let strongestNegative: CorrelogramData['strongestNegative'] = null;

  for (let i = 0; i < categories.length; i++) {
    for (let j = 0; j < categories.length; j++) {
      if (i === j) {
        matrix[i][j] = 1;
        continue;
      }
      let num = 0;
      let denA = 0;
      let denB = 0;
      for (let k = 0; k < n; k++) {
        const da = vectors[i][k] - means[i];
        const db = vectors[j][k] - means[j];
        num += da * db;
        denA += da * da;
        denB += db * db;
      }
      const denom = Math.sqrt(denA * denB);
      const r = denom > 0 ? Number((num / denom).toFixed(3)) : 0;
      matrix[i][j] = r;

      if (i < j) {
        if (!strongestPositive || r > strongestPositive.r) {
          strongestPositive = { catA: categories[i], catB: categories[j], r };
        }
        if (!strongestNegative || r < strongestNegative.r) {
          strongestNegative = { catA: categories[i], catB: categories[j], r };
        }
      }
    }
  }

  return { categories, matrix, strongestPositive, strongestNegative };
}

export function computeProductOpportunityMatrix(
  products: ProductMetric[],
  capabilities: DatasetCapabilities
): {
  points: OpportunityPoint[];
  xAxisLabel: string;
  yAxisLabel: string;
  xMedian: number;
  yMedian: number;
} {
  if (products.length === 0) {
    return {
      points: [],
      xAxisLabel: 'Sales',
      yAxisLabel: 'Growth',
      xMedian: 0,
      yMedian: 0,
    };
  }

  const useGrowth = capabilities.hasDate && products.some((p) => p.growthPct !== null);
  const useReorder = !useGrowth && capabilities.hasReorder && products.some((p) => p.reorderRatePct !== null);

  const xAxisLabel = capabilities.hasRevenue ? 'Total Revenue ($)' : 'Order Frequency (Baskets)';
  const yAxisLabel = useGrowth
    ? 'Period Growth (%)'
    : useReorder
      ? 'Reorder Rate (%)'
      : 'Basket Penetration (%)';

  const rawPoints = products.map((p) => ({
    productName: p.productName,
    category: p.category,
    xValue: capabilities.hasRevenue ? (p.totalRevenue ?? 0) : p.transactionCount,
    yValue: useGrowth
      ? (p.growthPct ?? 0)
      : useReorder
        ? (p.reorderRatePct ?? 0)
        : p.basketPenetrationPct,
    sizeValue: p.totalQuantity,
  }));

  const xs = [...rawPoints.map((p) => p.xValue)].sort((a, b) => a - b);
  const ys = [...rawPoints.map((p) => p.yValue)].sort((a, b) => a - b);
  const xMedian = xs[Math.floor(xs.length / 2)] ?? 0;
  const yMedian = ys[Math.floor(ys.length / 2)] ?? 0;

  const points: OpportunityPoint[] = rawPoints.map((p) => {
    let quadrant: OpportunityQuadrant;
    if (p.xValue >= xMedian && p.yValue >= yMedian) {
      quadrant = 'Stars (High Performance & Growth)';
    } else if (p.xValue >= xMedian && p.yValue < yMedian) {
      quadrant = 'Core Staples (High Volume, Mature)';
    } else if (p.xValue < xMedian && p.yValue >= yMedian) {
      quadrant = 'Rising Opportunities (Emerging Growth)';
    } else {
      quadrant = 'Watchlist (Low Volume & Declining)';
    }
    return { ...p, quadrant };
  });

  return {
    points,
    xAxisLabel,
    yAxisLabel,
    xMedian: Number(xMedian.toFixed(2)),
    yMedian: Number(yMedian.toFixed(2)),
  };
}
