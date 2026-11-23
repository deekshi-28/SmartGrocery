import {
  AnomalyPoint,
  AskDataResponse,
  AssociationRule,
  BasketAnalyticsResult,
  BusinessInsight,
  CategoryMetric,
  CleanedTransaction,
  CustomerRFM,
  DatasetCapabilities,
  ForecastResult,
  ProductMetric,
  RecommendationItem,
  SalesTimePoint,
  ShoppingPatternsResult,
  SimulationConfig,
  SimulationResult,
} from '../types/analytics';

export function computeRecommendations(
  rules: AssociationRule[],
  frequentTriples: { items: [string, string, string]; count: number; support: number }[],
  products: ProductMetric[],
  categories: CategoryMetric[],
  capabilities: DatasetCapabilities
): RecommendationItem[] {
  const recs: RecommendationItem[] = [];

  // 1. Top Cross-Selling rules (1 -> 1)
  const singleRules = rules.filter((r) => r.antecedents.length === 1 && r.consequents.length === 1);
  const seenPairs = new Set<string>();
  for (const r of singleRules) {
    if (recs.filter((x) => x.type === 'Cross-Selling').length >= 6) break;
    const key = [r.antecedentLabel, r.consequentLabel].sort().join('|||');
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);

    const prod = products.find((p) => p.productName === r.antecedentLabel);
    recs.push({
      id: `rec-xsell-${r.id}`,
      type: 'Cross-Selling',
      title: `Pair "${r.antecedentLabel}" with "${r.consequentLabel}"`,
      summary: `${(r.confidence * 100).toFixed(1)}% of shoppers buying ${r.antecedentLabel} also purchase ${r.consequentLabel} (${r.lift.toFixed(2)}x lift).`,
      primaryProduct: r.antecedentLabel,
      relatedProducts: [r.consequentLabel],
      category: prod?.category || 'Cross-Category',
      metricsLabel: `Lift ${r.lift.toFixed(2)}x · Conf ${(r.confidence * 100).toFixed(0)}% · ${r.coOccurrenceCount} baskets`,
      confidenceOrScore: r.lift,
      rationale: `Observed together in ${r.coOccurrenceCount} baskets (support ${(r.support * 100).toFixed(1)}%). Co-locating or adding checkout prompts increases attach rate.`,
    });
  }

  // 2. Product Bundles from 3-itemsets or top 2->1 rules
  for (let i = 0; i < Math.min(4, frequentTriples.length); i++) {
    const t = frequentTriples[i];
    const prod = products.find((p) => p.productName === t.items[0]);
    recs.push({
      id: `rec-bundle-${i}`,
      type: 'Product Bundle',
      title: `Meal / Basket Bundle: ${t.items[0]} + ${t.items[1]} + ${t.items[2]}`,
      summary: `Frequently purchased together as a 3-item combination across ${t.count} transactions (${(t.support * 100).toFixed(1)}% of all baskets).`,
      primaryProduct: t.items[0],
      relatedProducts: [t.items[1], t.items[2]],
      category: prod?.category || 'Multi-Category',
      metricsLabel: `Support ${(t.support * 100).toFixed(1)}% · ${t.count} co-occurring baskets`,
      confidenceOrScore: t.count,
      rationale: `Creating a 10% multi-buy bundle around these three items targets an existing natural shopping mission while lifting units per basket.`,
    });
  }

  // 3. Category Promotion Opportunities
  const sortedCats = [...categories];
  for (const cat of sortedCats.slice(0, 4)) {
    const growthNote =
      cat.growthPct !== null
        ? cat.growthPct >= 0
          ? `growing +${cat.growthPct}% period-over-period`
          : `softening ${cat.growthPct}% period-over-period`
        : `${cat.quantitySharePct}% of total unit volume`;
    recs.push({
      id: `rec-cat-${cat.category}`,
      type: 'Category Promotion',
      title:
        cat.growthPct !== null && cat.growthPct < 0
          ? `Re-engagement Promotion for ${cat.category}`
          : `Hero Spotlight Campaign for ${cat.category}`,
      summary: `${cat.category} accounts for ${capabilities.hasRevenue && cat.revenueSharePct !== null ? `${cat.revenueSharePct}% of revenue` : `${cat.quantitySharePct}% of units`} and is ${growthNote}.`,
      primaryProduct: cat.subcategories[0]?.name || cat.category,
      relatedProducts: cat.subcategories.slice(1, 3).map((s) => s.name),
      category: cat.category,
      metricsLabel: `${cat.transactionCount} baskets · ${cat.uniqueProducts} SKUs`,
      confidenceOrScore: cat.transactionCount,
      rationale:
        cat.growthPct !== null && cat.growthPct < 0
          ? `Targeted weekend multi-buy incentives can arrest the ${cat.growthPct}% decline without eroding core staple margins.`
          : `High basket penetration makes ${cat.category} an effective traffic driver for aisle end-caps and digital circulars.`,
    });
  }

  // 4. Inventory Actions (Fast-moving & Slow-moving)
  const slowProducts = products
    .filter((p) => p.velocityTier === 'Slow-Moving')
    .slice(0, 3);
  for (const sp of slowProducts) {
    recs.push({
      id: `rec-inv-${sp.productName}`,
      type: 'Inventory Action',
      title: `Clearance / Bundle Review: ${sp.productName}`,
      summary: `Slow-moving SKU appearing in only ${sp.basketPenetrationPct}% of baskets (${sp.totalQuantity} units total).`,
      primaryProduct: sp.productName,
      relatedProducts: [],
      category: sp.category,
      metricsLabel: `Rank #${sp.rank} · ${sp.totalQuantity} units`,
      confidenceOrScore: sp.totalQuantity,
      rationale: `Consider pairing ${sp.productName} with a fast-moving anchor in ${sp.category} or trimming safety stock to free shelf space.`,
    });
  }

  return recs;
}

export function runPromotionSimulation(
  config: SimulationConfig,
  transactions: CleanedTransaction[],
  products: ProductMetric[],
  categories: CategoryMetric[],
  rules: AssociationRule[],
  capabilities: DatasetCapabilities
): SimulationResult {
  // Strictly hypothetical scenario model using empirical baseline + retail price elasticity assumptions
  const targetTx = transactions.filter((tx) =>
    config.targetScope === 'product'
      ? tx.productName === config.productName
      : tx.category === config.categoryName
  );

  // Determine historical daily rate
  const uniqueDates = new Set(transactions.map((t) => t.purchaseDate).filter(Boolean));
  const historicalDays = uniqueDates.size > 0 ? uniqueDates.size : 30;
  const scaleFactor = config.durationDays / historicalDays;

  const historicalUnits = targetTx.reduce((s, t) => s + t.quantity, 0);
  const baselineUnits = Math.max(1, Math.round(historicalUnits * scaleFactor));

  const historicalMetric = capabilities.hasRevenue
    ? targetTx.reduce((s, t) => s + (t.revenue ?? 0), 0)
    : new Set(targetTx.map((t) => t.transactionId)).size;
  const baselineMetricValue = Math.max(1, Number((historicalMetric * scaleFactor).toFixed(2)));

  // Retail grocery elasticity varies by promo type and discount depth
  const baseElasticity =
    config.promotionType === 'Percentage Discount'
      ? 1.55
      : config.promotionType === 'Bundle Offer (Buy 2 Get Discount)'
        ? 1.78
        : 1.25;

  const displayLiftBonus = config.promotionType === 'Featured Display Placement' ? 0.14 : 0;
  const bundleLiftBonus = config.promotionType === 'Bundle Offer (Buy 2 Get Discount)' ? 0.08 : 0;

  // Diminishing returns above 30% discount
  const effectiveDiscount = config.discountPct / 100;
  const unitLiftRatio =
    baseElasticity * effectiveDiscount * (1 - 0.35 * effectiveDiscount) +
    displayLiftBonus +
    bundleLiftBonus;

  const projectedUnits = Math.round(baselineUnits * (1 + unitLiftRatio));
  const unitLiftPct = Number((unitLiftRatio * 100).toFixed(1));

  let projectedMetricValue: number;
  if (capabilities.hasRevenue) {
    // Revenue = BaselineRevenue * (1 + unitLift) * (1 - effectiveDiscount)
    const realizedPriceFactor =
      config.promotionType === 'Featured Display Placement'
        ? 1 - effectiveDiscount * 0.4
        : 1 - effectiveDiscount;
    projectedMetricValue = Number((baselineMetricValue * (1 + unitLiftRatio) * realizedPriceFactor).toFixed(2));
  } else {
    // No revenue column (e.g., Instacart) -> project order/basket engagement volume
    projectedMetricValue = Math.round(baselineMetricValue * (1 + unitLiftRatio * 0.85));
  }

  const netMetricDelta = Number((projectedMetricValue - baselineMetricValue).toFixed(2));
  const netMetricDeltaPct =
    baselineMetricValue > 0 ? Number(((netMetricDelta / baselineMetricValue) * 100).toFixed(1)) : 0;

  // Halo cross-sell lift computed from genuine association rules linked to target
  const relevantRules = rules.filter((r) =>
    config.targetScope === 'product'
      ? r.antecedents.includes(config.productName)
      : products.some((p) => p.category === config.categoryName && r.antecedents.includes(p.productName))
  );
  const avgPartnerConf =
    relevantRules.length > 0
      ? relevantRules.slice(0, 3).reduce((s, r) => s + r.confidence, 0) / Math.min(3, relevantRules.length)
      : 0.18;
  const incrementalUnits = Math.max(0, projectedUnits - baselineUnits);
  const haloCrossSellLiftUnits = Math.round(incrementalUnits * avgPartnerConf);

  const dailyBaseline = baselineMetricValue / Math.max(1, config.durationDays);
  const dailyProjected = projectedMetricValue / Math.max(1, config.durationDays);
  const dailyComparison = Array.from({ length: Math.min(30, config.durationDays) }, (_, i) => {
    const wave = 1 + 0.12 * Math.sin((i / 7) * 2 * Math.PI);
    return {
      day: `Day ${i + 1}`,
      baseline: Number((dailyBaseline * wave).toFixed(2)),
      simulated: Number((dailyProjected * wave).toFixed(2)),
    };
  });

  const metricLabel = capabilities.hasRevenue ? 'Projected Revenue' : 'Projected Order Mentions';
  const marginImpactNote = capabilities.hasRevenue
    ? netMetricDelta >= 0
      ? `Estimated top-line lift of +${netMetricDeltaPct}% under elasticity ε=${baseElasticity.toFixed(2)}; verify unit margin exceeds ${config.discountPct}% discount depth.`
      : `At ${config.discountPct}% discount, unit growth (+${unitLiftPct}%) does not fully offset price compression (${netMetricDeltaPct}% net revenue estimate). Consider a ${Math.max(5, config.discountPct - 10)}% bundle instead.`
    : `Estimated order volume lift of +${unitLiftPct}% across ${config.durationDays} days based on historical transaction frequency (monetary revenue unavailable for this dataset).`;

  return {
    isEstimate: true,
    elasticityUsed: baseElasticity,
    baselineUnits,
    projectedUnits,
    unitLiftPct,
    baselineMetricValue,
    projectedMetricValue,
    netMetricDelta,
    netMetricDeltaPct,
    metricLabel,
    haloCrossSellLiftUnits,
    marginImpactNote,
    dailyComparison,
  };
}

export function computeBusinessInsights(
  basket: BasketAnalyticsResult,
  categories: CategoryMetric[],
  products: ProductMetric[],
  rules: AssociationRule[],
  forecast: ForecastResult,
  anomalies: AnomalyPoint[],
  patterns: ShoppingPatternsResult,
  capabilities: DatasetCapabilities,
  currencySymbol: string
): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  // Pillar 1: Business Insights
  if (categories.length > 0) {
    const topCat = categories[0];
    insights.push({
      id: 'ins-top-cat',
      pillar: 'Business Insights',
      title: `${topCat.category} leads storewide contribution`,
      summary:
        capabilities.hasRevenue && topCat.revenue !== null
          ? `${topCat.category} generates ${currencySymbol}${topCat.revenue.toLocaleString()} (${topCat.revenueSharePct}% of total revenue) across ${topCat.transactionCount} baskets.`
          : `${topCat.category} drives ${topCat.quantitySharePct}% of total units (${topCat.quantity.toLocaleString()} items) across ${topCat.transactionCount} orders.`,
      metricValue:
        capabilities.hasRevenue && topCat.revenueSharePct !== null
          ? `${topCat.revenueSharePct}% Rev Share`
          : `${topCat.quantitySharePct}% Unit Share`,
      severity: 'positive',
      targetPage: 'categories',
    });
  }

  const weekend = patterns.weekdayVsWeekend;
  if (weekend.weekdayOrders + weekend.weekendOrders > 0) {
    const weekendLarger = weekend.weekendAvgSize >= weekend.weekdayAvgSize;
    insights.push({
      id: 'ins-weekend',
      pillar: 'Business Insights',
      title: weekendLarger ? 'Weekend baskets carry more items' : 'Weekday shopping drives core volume',
      summary: `Weekend baskets average ${weekend.weekendAvgSize} items (${weekend.weekendOrders} orders) vs ${weekend.weekdayAvgSize} items on weekdays (${weekend.weekdayOrders} orders).`,
      metricValue: `${weekend.weekendAvgSize} vs ${weekend.weekdayAvgSize} items`,
      severity: 'neutral',
      targetPage: 'patterns',
    });
  }

  // Pillar 2: Retail Recommendations
  if (rules.length > 0) {
    const topRule = rules[0];
    insights.push({
      id: 'ins-top-rule',
      pillar: 'Retail Recommendations',
      title: `High-lift bundle: ${topRule.antecedentLabel} -> ${topRule.consequentLabel}`,
      summary: `Shoppers buying ${topRule.antecedentLabel} are ${topRule.lift.toFixed(2)}x more likely to also add ${topRule.consequentLabel} (${(topRule.confidence * 100).toFixed(1)}% confidence).`,
      metricValue: `Lift ${topRule.lift.toFixed(2)}x`,
      severity: 'positive',
      targetPage: 'recommendations',
    });
  } else {
    insights.push({
      id: 'ins-mba-empty',
      pillar: 'Retail Recommendations',
      title: 'Adjust association thresholds to uncover bundles',
      summary: `Average basket size is ${basket.avgBasketSize} items. Lower minimum support/confidence in Market Basket Analysis to inspect subtle cross-sell pairings.`,
      metricValue: `${basket.avgBasketSize} items/basket`,
      severity: 'neutral',
      targetPage: 'market-basket',
    });
  }

  // Pillar 3: Forecasted Trends
  if (forecast.supported && forecast.points.length > 0) {
    const hist = forecast.points.filter((p) => p.actual !== null);
    const pred = forecast.points.filter((p) => p.actual === null && p.forecast !== null);
    const lastHist = hist[hist.length - 1]?.actual ?? 0;
    const lastPred = pred[pred.length - 1]?.forecast ?? 0;
    const changePct = lastHist > 0 ? (((lastPred - lastHist) / lastHist) * 100).toFixed(1) : '0.0';
    insights.push({
      id: 'ins-forecast',
      pillar: 'Forecasted Trends',
      title: `${forecast.granularity === 'weekly' ? 'Weekly' : 'Monthly'} demand projected ${Number(changePct) >= 0 ? 'upward' : 'downward'}`,
      summary: `${forecast.modelName} projects ${Number(changePct) >= 0 ? '+' : ''}${changePct}% change over the next ${forecast.horizonPeriods} periods (MAPE ${forecast.mapePct}%).`,
      metricValue: `${Number(changePct) >= 0 ? '+' : ''}${changePct}% Horizon`,
      severity: Number(changePct) >= 0 ? 'positive' : 'warning',
      targetPage: 'forecasting',
    });
  } else {
    insights.push({
      id: 'ins-forecast-unavail',
      pillar: 'Forecasted Trends',
      title: 'Calendar forecasting unavailable for this schema',
      summary:
        forecast.unsupportedReason ||
        'Dataset lacks calendar dates required for time-series demand forecasting.',
      metricValue: 'Requires Dates',
      severity: 'neutral',
      targetPage: 'forecasting',
    });
  }

  // Pillar 4: Anomaly Alerts
  if (anomalies.length > 0) {
    const topAnom = anomalies[0];
    insights.push({
      id: 'ins-anomaly',
      pillar: 'Anomaly Alerts',
      title: `${topAnom.type} detected on ${topAnom.period} (${topAnom.entityName})`,
      summary: topAnom.explanation,
      metricValue: `${topAnom.zScore > 0 ? '+' : ''}${topAnom.zScore}σ (${topAnom.type})`,
      severity: 'alert',
      targetPage: 'anomalies',
    });
  } else {
    insights.push({
      id: 'ins-anomaly-none',
      pillar: 'Anomaly Alerts',
      title: capabilities.hasDate ? 'No extreme statistical anomalies flagged' : 'Time-series anomaly scan unavailable',
      summary: capabilities.hasDate
        ? 'All historical daily sales and order counts remain within the configured ±2.0σ control band.'
        : 'Calendar timestamps are required to monitor daily spikes and drops.',
      metricValue: capabilities.hasDate ? '0 Alerts' : 'Requires Dates',
      severity: 'neutral',
      targetPage: 'anomalies',
    });
  }

  // Pillar 5: Inventory Suggestions
  const fastCount = products.filter((p) => p.velocityTier === 'Fast-Moving').length;
  const slowCount = products.filter((p) => p.velocityTier === 'Slow-Moving').length;
  const declining = products.filter((p) => p.growthPct !== null && p.growthPct < -10);
  const topFast = products[0];
  insights.push({
    id: 'ins-inventory',
    pillar: 'Inventory Suggestions',
    title: `${fastCount} Fast-Moving SKUs vs ${slowCount} Slow-Moving SKUs`,
    summary: topFast
      ? `${topFast.productName} leads velocity (${topFast.totalQuantity} units, ${topFast.basketPenetrationPct}% basket penetration). ${declining.length > 0 ? `${declining.length} products show >10% period decline.` : 'Review slow-movers for bundle placement.'}`
      : 'No SKU inventory data available.',
    metricValue: `${fastCount} Fast / ${slowCount} Slow`,
    severity: declining.length > 3 ? 'warning' : 'neutral',
    targetPage: 'products',
  });

  return insights;
}

export function answerDataQuery(
  rawQuery: string,
  context: {
    datasetName: string;
    currencySymbol: string;
    capabilities: DatasetCapabilities;
    basket: BasketAnalyticsResult;
    categories: CategoryMetric[];
    products: ProductMetric[];
    rules: AssociationRule[];
    patterns: ShoppingPatternsResult;
    salesMonthly: SalesTimePoint[];
    anomalies: AnomalyPoint[];
    customers: CustomerRFM[];
  }
): AskDataResponse {
  const q = rawQuery.trim().toLowerCase();
  const { currencySymbol: curr, capabilities, basket, categories, products, rules, patterns, salesMonthly, anomalies, customers } = context;

  const fmtVal = (n: number | null) =>
    n === null ? 'Unavailable' : `${curr}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // 1. Category highest sales / top categories
  if (q.includes('category') && (q.includes('highest') || q.includes('top') || q.includes('best') || q.includes('sales') || q.includes('revenue'))) {
    const top = categories[0];
    if (!top) {
      return {
        query: rawQuery,
        matchedIntent: 'Top Performing Category',
        answerText: 'No category metrics are available in the current filtered view.',
        keyMetrics: [],
        followUpSuggestions: ['What are the top 10 products?'],
      };
    }
    const metricWord = capabilities.hasRevenue ? 'revenue' : 'unit volume';
    return {
      query: rawQuery,
      matchedIntent: 'Category Performance Ranking',
      answerText: `In ${context.datasetName}, "${top.category}" ranks #1 by ${metricWord}, contributing ${capabilities.hasRevenue ? `${fmtVal(top.revenue)} (${top.revenueSharePct}%)` : `${top.quantity.toLocaleString()} units (${top.quantitySharePct}%)`} across ${top.transactionCount.toLocaleString()} baskets.`,
      keyMetrics: [
        { label: 'Top Category', value: top.category },
        { label: capabilities.hasRevenue ? 'Revenue' : 'Units Sold', value: capabilities.hasRevenue ? fmtVal(top.revenue) : top.quantity.toLocaleString() },
        { label: 'Share', value: `${capabilities.hasRevenue ? top.revenueSharePct : top.quantitySharePct}%` },
        { label: 'Baskets', value: top.transactionCount.toLocaleString() },
      ],
      tableHeaders: ['Rank', 'Category', capabilities.hasRevenue ? 'Revenue' : 'Units Sold', 'Share (%)', 'Baskets'],
      tableRows: categories.slice(0, 8).map((c, i) => [
        i + 1,
        c.category,
        capabilities.hasRevenue ? fmtVal(c.revenue) : c.quantity,
        `${capabilities.hasRevenue ? c.revenueSharePct : c.quantitySharePct}%`,
        c.transactionCount,
      ]),
      chartSpec: {
        title: `Category ${capabilities.hasRevenue ? 'Revenue' : 'Unit Volume'} Comparison`,
        xLabel: 'Category',
        yLabel: capabilities.hasRevenue ? `Revenue (${curr})` : 'Units Sold',
        labels: categories.slice(0, 8).map((c) => c.category),
        values: categories.slice(0, 8).map((c) => (capabilities.hasRevenue ? (c.revenue ?? 0) : c.quantity)),
        chartType: 'bar',
      },
      followUpSuggestions: [
        'What are the top 10 products?',
        'Which products are frequently bought together?',
        'What are the shopping patterns on weekends?',
      ],
    };
  }

  // 2. Top N products
  if ((q.includes('top') || q.includes('best') || q.includes('popular')) && q.includes('product')) {
    const matchNum = q.match(/top\s+(\d+)/);
    const limit = matchNum ? Math.min(20, Math.max(3, Number(matchNum[1]))) : 10;
    const topList = products.slice(0, limit);
    return {
      query: rawQuery,
      matchedIntent: `Top ${limit} Products`,
      answerText: `Here are the top ${topList.length} products in ${context.datasetName} ranked by ${capabilities.hasRevenue ? 'total revenue' : 'order frequency & volume'}. "${topList[0]?.productName}" leads with ${capabilities.hasRevenue ? fmtVal(topList[0]?.totalRevenue ?? 0) : `${topList[0]?.transactionCount} baskets`}.`,
      keyMetrics: [
        { label: '#1 Product', value: topList[0]?.productName || 'N/A' },
        { label: capabilities.hasRevenue ? '#1 Revenue' : '#1 Baskets', value: capabilities.hasRevenue ? fmtVal(topList[0]?.totalRevenue ?? 0) : `${topList[0]?.transactionCount ?? 0}` },
        { label: 'Total SKUs', value: products.length.toString() },
      ],
      tableHeaders: ['Rank', 'Product', 'Category', capabilities.hasRevenue ? 'Revenue' : 'Baskets', 'Units', 'Penetration'],
      tableRows: topList.map((p) => [
        p.rank,
        p.productName,
        p.category,
        capabilities.hasRevenue ? fmtVal(p.totalRevenue) : p.transactionCount,
        p.totalQuantity,
        `${p.basketPenetrationPct}%`,
      ]),
      chartSpec: {
        title: `Top ${topList.length} Products`,
        xLabel: 'Product',
        yLabel: capabilities.hasRevenue ? `Revenue (${curr})` : 'Basket Appearances',
        labels: topList.map((p) => p.productName),
        values: topList.map((p) => (capabilities.hasRevenue ? (p.totalRevenue ?? 0) : p.transactionCount)),
        chartType: 'bar',
      },
      followUpSuggestions: [
        'Show products with declining sales',
        'Which products have the highest association?',
        'What is the average basket value?',
      ],
    };
  }

  // 3. Frequently bought together / highest association
  if (q.includes('bought together') || q.includes('association') || q.includes('bundle') || q.includes('pair') || q.includes('cross')) {
    const topRules = rules.slice(0, 10);
    if (topRules.length === 0) {
      return {
        query: rawQuery,
        matchedIntent: 'Product Association Rules',
        answerText: 'No association rules met the current minimum support/confidence thresholds. Try lowering the minimum support or confidence in the Market Basket Analysis module.',
        keyMetrics: [{ label: 'Total Baskets', value: basket.totalBaskets.toLocaleString() }],
        followUpSuggestions: ['What are the top 10 products?'],
      };
    }
    const best = topRules[0];
    return {
      query: rawQuery,
      matchedIntent: 'Market Basket Associations',
      answerText: `The strongest association in ${context.datasetName} is "${best.antecedentLabel} -> ${best.consequentLabel}" with a lift of ${best.lift.toFixed(2)}x, ${(best.confidence * 100).toFixed(1)}% confidence, and ${best.coOccurrenceCount} co-occurring baskets.`,
      keyMetrics: [
        { label: 'Strongest Rule', value: `${best.antecedentLabel} -> ${best.consequentLabel}` },
        { label: 'Lift', value: `${best.lift.toFixed(2)}x` },
        { label: 'Confidence', value: `${(best.confidence * 100).toFixed(1)}%` },
        { label: 'Rules Mined', value: rules.length.toString() },
      ],
      tableHeaders: ['Antecedent (If Bought)', 'Consequent (Also Bought)', 'Support', 'Confidence', 'Lift', 'Baskets'],
      tableRows: topRules.map((r) => [
        r.antecedentLabel,
        r.consequentLabel,
        `${(r.support * 100).toFixed(2)}%`,
        `${(r.confidence * 100).toFixed(1)}%`,
        `${r.lift.toFixed(2)}x`,
        r.coOccurrenceCount,
      ]),
      followUpSuggestions: [
        'Which category has the highest sales?',
        'What is the average basket size?',
      ],
    };
  }

  // 4. Average basket value / size
  if (q.includes('basket') || q.includes('average order') || q.includes('aov')) {
    if (!capabilities.hasRevenue && q.includes('value')) {
      return {
        query: rawQuery,
        matchedIntent: 'Basket Value & Size Analysis',
        answerText: `${context.datasetName} does not include unit prices or monetary revenue, so monetary basket value cannot be computed without fabricating prices. However, the average basket size is ${basket.avgBasketSize} items (median ${basket.medianBasketSize} items) across ${basket.totalBaskets.toLocaleString()} orders.`,
        keyMetrics: [
          { label: 'Total Baskets', value: basket.totalBaskets.toLocaleString() },
          { label: 'Avg Basket Size', value: `${basket.avgBasketSize} items` },
          { label: 'Median Basket Size', value: `${basket.medianBasketSize} items` },
          { label: 'Avg Basket Value', value: 'Unavailable (No Prices)' },
        ],
        followUpSuggestions: [
          'What are the shopping patterns on weekends?',
          'Which products are frequently bought together?',
        ],
      };
    }

    return {
      query: rawQuery,
      matchedIntent: 'Basket Value & Size Analysis',
      answerText: capabilities.hasRevenue
        ? `Across ${basket.totalBaskets.toLocaleString()} cleaned baskets, the average basket value is ${fmtVal(basket.avgBasketValue)} (median ${fmtVal(basket.medianBasketValue)}, range ${fmtVal(basket.minBasketValue)}–${fmtVal(basket.maxBasketValue)}), with an average of ${basket.avgBasketSize} items per basket.`
        : `Across ${basket.totalBaskets.toLocaleString()} orders, the average basket size is ${basket.avgBasketSize} items (median ${basket.medianBasketSize}, max ${basket.maxBasketSize} items).`,
      keyMetrics: [
        { label: 'Total Baskets', value: basket.totalBaskets.toLocaleString() },
        ...(capabilities.hasRevenue
          ? [
              { label: 'Avg Basket Value', value: fmtVal(basket.avgBasketValue) },
              { label: 'Median Basket Value', value: fmtVal(basket.medianBasketValue) },
            ]
          : []),
        { label: 'Avg Basket Size', value: `${basket.avgBasketSize} items` },
      ],
      followUpSuggestions: [
        'Which month had the highest sales?',
        'What are the shopping patterns on weekends?',
      ],
    };
  }

  // 5. Highest month / sales trend
  if (q.includes('month') || q.includes('when') && q.includes('highest') || q.includes('trend')) {
    if (!capabilities.hasDate || salesMonthly.length === 0) {
      return {
        query: rawQuery,
        matchedIntent: 'Monthly Sales Trends',
        answerText: `${context.datasetName} does not contain calendar dates, so monthly calendar sales trends are unavailable. Check day-of-week and hour-of-day shopping patterns instead.`,
        keyMetrics: [{ label: 'Calendar Dates', value: 'Unavailable' }],
        followUpSuggestions: ['What are the shopping patterns on weekends?'],
      };
    }

    const bestMonth = [...salesMonthly].sort((a, b) =>
      capabilities.hasRevenue ? (b.revenue ?? 0) - (a.revenue ?? 0) : b.quantity - a.quantity
    )[0];

    return {
      query: rawQuery,
      matchedIntent: 'Monthly Sales Performance',
      answerText: `The highest-performing month in ${context.datasetName} was ${bestMonth.period}, generating ${capabilities.hasRevenue ? fmtVal(bestMonth.revenue) : `${bestMonth.quantity.toLocaleString()} units`} across ${bestMonth.transactions.toLocaleString()} transactions.`,
      keyMetrics: [
        { label: 'Peak Month', value: bestMonth.period },
        { label: capabilities.hasRevenue ? 'Peak Revenue' : 'Peak Units', value: capabilities.hasRevenue ? fmtVal(bestMonth.revenue) : bestMonth.quantity.toLocaleString() },
        { label: 'Orders in Peak Month', value: bestMonth.transactions.toLocaleString() },
      ],
      tableHeaders: ['Month', capabilities.hasRevenue ? 'Revenue' : 'Units', 'Transactions', 'MoM Growth'],
      tableRows: salesMonthly.map((m) => [
        m.period,
        capabilities.hasRevenue ? fmtVal(m.revenue) : m.quantity,
        m.transactions,
        m.growthPct !== null ? `${m.growthPct > 0 ? '+' : ''}${m.growthPct}%` : '—',
      ]),
      chartSpec: {
        title: 'Monthly Sales Trend',
        xLabel: 'Month',
        yLabel: capabilities.hasRevenue ? `Revenue (${curr})` : 'Units Sold',
        labels: salesMonthly.map((m) => m.period),
        values: salesMonthly.map((m) => (capabilities.hasRevenue ? (m.revenue ?? 0) : m.quantity)),
        chartType: 'line',
      },
      followUpSuggestions: [
        'Show products with declining sales',
        'Are there any sales anomalies?',
      ],
    };
  }

  // 6. Declining / slow products
  if (q.includes('declin') || q.includes('slow') || q.includes('drop') || q.includes('underperform')) {
    const withGrowth = products.filter((p) => p.growthPct !== null).sort((a, b) => (a.growthPct ?? 0) - (b.growthPct ?? 0));
    if (withGrowth.length > 0) {
      const declining = withGrowth.filter((p) => (p.growthPct ?? 0) < 0).slice(0, 10);
      const list = declining.length > 0 ? declining : withGrowth.slice(0, 8);
      return {
        query: rawQuery,
        matchedIntent: 'Declining & Slow-Moving Products',
        answerText:
          declining.length > 0
            ? `Found ${declining.length} products with negative second-half period growth. "${list[0].productName}" showed the steepest decline at ${list[0].growthPct}%.`
            : `No products showed negative growth; showing the ${list.length} lowest-growth items for review.`,
        keyMetrics: [
          { label: 'Declining SKUs', value: declining.length.toString() },
          { label: 'Steepest Change', value: `${list[0]?.growthPct ?? 0}%` },
          { label: 'Slow-Moving Tier', value: products.filter((p) => p.velocityTier === 'Slow-Moving').length.toString() },
        ],
        tableHeaders: ['Product', 'Category', 'Growth (%)', 'Units', 'Velocity Tier'],
        tableRows: list.map((p) => [
          p.productName,
          p.category,
          `${(p.growthPct ?? 0) > 0 ? '+' : ''}${p.growthPct ?? 0}%`,
          p.totalQuantity,
          p.velocityTier,
        ]),
        chartSpec: {
          title: 'Lowest Period Growth Products (%)',
          xLabel: 'Product',
          yLabel: 'Period Growth (%)',
          labels: list.map((p) => p.productName),
          values: list.map((p) => p.growthPct ?? 0),
          chartType: 'bar',
        },
        followUpSuggestions: [
          'What are the top 10 products?',
          'Which products are frequently bought together?',
        ],
      };
    }

    const slow = products.filter((p) => p.velocityTier === 'Slow-Moving').slice(0, 10);
    return {
      query: rawQuery,
      matchedIntent: 'Slow-Moving Products',
      answerText: `Because this dataset has no calendar dates for period-over-period growth, here are the ${slow.length} slowest-moving SKUs ranked by basket penetration.`,
      keyMetrics: [{ label: 'Slow-Moving SKUs', value: slow.length.toString() }],
      tableHeaders: ['Rank', 'Product', 'Category', 'Baskets', 'Penetration'],
      tableRows: slow.map((p) => [p.rank, p.productName, p.category, p.transactionCount, `${p.basketPenetrationPct}%`]),
      followUpSuggestions: ['What are the top 10 products?'],
    };
  }

  // 7. Weekend / shopping patterns
  if (q.includes('weekend') || q.includes('weekday') || q.includes('hour') || q.includes('pattern') || q.includes('day')) {
    const w = patterns.weekdayVsWeekend;
    const peakDay = [...patterns.byDay].sort((a, b) => b.orders - a.orders)[0];
    const peakHour = [...patterns.byHour].sort((a, b) => b.orders - a.orders)[0];
    return {
      query: rawQuery,
      matchedIntent: 'Shopping Day & Hour Patterns',
      answerText: `Peak shopping occurs on ${peakDay?.dayName || 'N/A'} (${peakDay?.orders || 0} orders) and around ${peakHour?.label || 'N/A'} (${peakHour?.orders || 0} orders). Weekend orders (${w.weekendOrders}) average ${w.weekendAvgSize} items per basket compared to ${w.weekdayAvgSize} items on weekdays (${w.weekdayOrders} orders).`,
      keyMetrics: [
        { label: 'Peak Day', value: peakDay?.dayName || 'N/A' },
        { label: 'Peak Hour', value: peakHour?.label || 'N/A' },
        { label: 'Weekend Orders', value: w.weekendOrders.toLocaleString() },
        { label: 'Weekday Orders', value: w.weekdayOrders.toLocaleString() },
      ],
      tableHeaders: ['Day of Week', 'Type', 'Orders', 'Items', ...(capabilities.hasRevenue ? ['Revenue'] : [])],
      tableRows: patterns.byDay.map((d) => [
        d.dayName,
        d.isWeekend ? 'Weekend' : 'Weekday',
        d.orders,
        d.items,
        ...(capabilities.hasRevenue ? [fmtVal(d.revenue)] : []),
      ]),
      chartSpec: {
        title: 'Orders by Day of Week',
        xLabel: 'Day',
        yLabel: 'Orders',
        labels: patterns.byDay.map((d) => d.dayName),
        values: patterns.byDay.map((d) => d.orders),
        chartType: 'bar',
      },
      followUpSuggestions: [
        'Which category has the highest sales?',
        'What is the average basket value?',
      ],
    };
  }

  // 8. Anomalies
  if (q.includes('anomal') || q.includes('spike') || q.includes('unusual')) {
    if (!capabilities.hasDate) {
      return {
        query: rawQuery,
        matchedIntent: 'Anomaly Detection',
        answerText: `${context.datasetName} does not include calendar dates, so time-series spike/drop detection is unavailable.`,
        keyMetrics: [],
        followUpSuggestions: ['What are the shopping patterns on weekends?'],
      };
    }
    return {
      query: rawQuery,
      matchedIntent: 'Statistical Anomaly Summary',
      answerText:
        anomalies.length > 0
          ? `Detected ${anomalies.length} statistical anomalies (±2.0σ threshold). Most prominent: ${anomalies[0].type} on ${anomalies[0].period} (${anomalies[0].entityName}) — ${anomalies[0].explanation}`
          : 'No statistical anomalies exceeded the ±2.0σ threshold.',
      keyMetrics: [
        { label: 'Total Anomalies', value: anomalies.length.toString() },
        { label: 'Spikes', value: anomalies.filter((a) => a.type === 'Spike').length.toString() },
        { label: 'Drops', value: anomalies.filter((a) => a.type === 'Drop').length.toString() },
      ],
      tableHeaders: ['Period', 'Metric', 'Entity', 'Type', 'Z-Score', 'Deviation'],
      tableRows: anomalies.slice(0, 8).map((a) => [
        a.period,
        a.metric,
        a.entityName,
        a.type,
        `${a.zScore > 0 ? '+' : ''}${a.zScore}σ`,
        `${a.deviationPct > 0 ? '+' : ''}${a.deviationPct}%`,
      ]),
      followUpSuggestions: ['Which month had the highest sales?'],
    };
  }

  // 9. Customers / RFM
  if (q.includes('customer') || q.includes('vip') || q.includes('rfm') || q.includes('segment')) {
    if (!capabilities.hasCustomerId || customers.length === 0) {
      return {
        query: rawQuery,
        matchedIntent: 'Customer RFM Summary',
        answerText: 'Customer identifiers are not present in this dataset.',
        keyMetrics: [],
        followUpSuggestions: ['What are the top 10 products?'],
      };
    }
    const segCounts = new Map<string, number>();
    customers.forEach((c) => segCounts.set(c.segment, (segCounts.get(c.segment) ?? 0) + 1));
    const vips = segCounts.get('VIP') ?? 0;
    return {
      query: rawQuery,
      matchedIntent: 'Customer RFM Segmentation',
      answerText: `Analyzed ${customers.length.toLocaleString()} unique customers. ${vips} customers qualify as VIP (${((vips / customers.length) * 100).toFixed(1)}%), and "${customers[0].customerId}" is the top customer with ${customers[0].frequency} orders.`,
      keyMetrics: [
        { label: 'Total Customers', value: customers.length.toLocaleString() },
        { label: 'VIP Segment', value: vips.toString() },
        { label: 'Top Customer', value: customers[0].customerId },
      ],
      tableHeaders: ['Segment', 'Customers', 'Share'],
      tableRows: Array.from(segCounts.entries()).map(([seg, cnt]) => [
        seg,
        cnt,
        `${((cnt / customers.length) * 100).toFixed(1)}%`,
      ]),
      followUpSuggestions: ['What is the average basket value?'],
    };
  }

  // Fallback: executive summary matching dataset
  return {
    query: rawQuery,
    matchedIntent: 'Executive Dataset Summary',
    answerText: `Summary for ${context.datasetName}: ${basket.totalBaskets.toLocaleString()} baskets, ${products.length} products across ${categories.length} categories, and an average basket size of ${basket.avgBasketSize} items${capabilities.hasRevenue ? ` (average basket value ${fmtVal(basket.avgBasketValue)}, total revenue ${fmtVal(basket.totalRevenue)})` : ''}. Try asking one of the suggested analytical questions below for a specific drill-down.`,
    keyMetrics: [
      { label: 'Baskets', value: basket.totalBaskets.toLocaleString() },
      { label: 'Products', value: products.length.toString() },
      { label: 'Categories', value: categories.length.toString() },
      { label: 'Avg Basket Size', value: `${basket.avgBasketSize} items` },
    ],
    followUpSuggestions: [
      'Which category has the highest sales?',
      'What are the top 10 products?',
      'Which products are frequently bought together?',
      'What is the average basket value?',
      'Which month had the highest sales?',
      'Show products with declining sales',
      'What are the shopping patterns on weekends?',
    ],
  };
}
