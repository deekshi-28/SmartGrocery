export type PageId =
  | 'home'
  | 'datasets'
  | 'preprocessing'
  | 'quality'
  | 'baskets'
  | 'categories'
  | 'products'
  | 'customers'
  | 'patterns'
  | 'sales'
  | 'market-basket'
  | 'network'
  | 'forecasting'
  | 'anomalies'
  | 'recommendations'
  | 'simulator'
  | 'ask-data'
  | 'reports';

export type DatasetKind = 'uci_retail' | 'instacart' | 'custom';

export type RawRow = Record<string, string | number | boolean | Date | null | undefined>;

export interface ColumnProfile {
  name: string;
  detectedType: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
  nonNullCount: number;
  missingCount: number;
  missingPct: number;
  uniqueCount: number;
  sampleValues: string[];
}

export interface ColumnMapping {
  transactionId: string | null;
  customerId: string | null;
  productName: string | null;
  category: string | null;
  subcategory: string | null;
  quantity: string | null;
  unitPrice: string | null;
  totalSales: string | null;
  purchaseDate: string | null;
  purchaseTime: string | null;
  dayOfWeek: string | null;
  hourOfDay: string | null;
  reordered: string | null;
  daysSincePrior: string | null;
}

export interface DatasetCapabilities {
  hasTransactionId: boolean;
  hasCustomerId: boolean;
  hasCategory: boolean;
  hasQuantity: boolean;
  hasPrice: boolean;
  hasRevenue: boolean;
  hasDate: boolean;
  hasTime: boolean;
  hasHour: boolean;
  hasDow: boolean;
  hasReorder: boolean;
  hasDaysSincePrior: boolean;
}

export interface CleaningConfig {
  removeCancelledInvoices: boolean;
  removeInvalidQuantities: boolean;
  removeInvalidPrices: boolean;
  removeMissingProducts: boolean;
  removeMissingCustomers: boolean;
  removeDuplicates: boolean;
  standardizeProductNames: boolean;
  autoTagCategories: boolean;
}

export interface CleaningActionLog {
  id: string;
  action: string;
  field: string;
  affectedRows: number;
  status: 'applied' | 'skipped' | 'not_applicable';
  detail: string;
}

export interface DataQualityReport {
  totalRawRows: number;
  totalCleanedRows: number;
  removedRows: number;
  validRowsPct: number;
  rawMissingCells: number;
  cleanedMissingCells: number;
  duplicateRowsFound: number;
  cancelledRowsFound: number;
  invalidQuantityRowsFound: number;
  invalidPriceRowsFound: number;
  missingProductRowsFound: number;
  missingCustomerRowsFound: number;
  standardizedProductCount: number;
  autoTaggedCategoryCount: number;
  qualityScoreBefore: number;
  qualityScoreAfter: number;
  qualityFormulaNote: string;
  columnProfilesBefore: ColumnProfile[];
  columnProfilesAfter: ColumnProfile[];
  cleaningLog: CleaningActionLog[];
}

export interface CleanedTransaction {
  rowIndex: number;
  transactionId: string;
  customerId: string | null;
  rawProductName: string;
  productName: string;
  category: string;
  subcategory: string;
  tags: string[];
  quantity: number;
  unitPrice: number | null;
  revenue: number | null;
  purchaseDate: string | null; // YYYY-MM-DD
  purchaseTime: string | null; // HH:MM
  dayOfWeekIndex: number | null; // 0 (Sun) - 6 (Sat)
  dayOfWeekName: string | null;
  hourOfDay: number | null; // 0 - 23
  isWeekend: boolean | null;
  reordered: number | null; // 0 or 1
  daysSincePrior: number | null;
  wasStandardized: boolean;
  wasAutoTagged: boolean;
}

export interface DatasetSource {
  id: string;
  name: string;
  kind: DatasetKind;
  description: string;
  currencySymbol: string;
  sourceFormat: 'Built-in Dataset' | 'CSV Upload' | 'Excel Upload';
  fileName?: string;
  uploadedAt: string;
  rawRows: RawRow[];
  columns: string[];
  mapping: ColumnMapping;
  cleaningConfig: CleaningConfig;
  notes: string[];
}

// Module 2 Types
export interface BasketSummary {
  transactionId: string;
  customerId: string | null;
  purchaseDate: string | null;
  dayOfWeekName: string | null;
  hourOfDay: number | null;
  isWeekend: boolean | null;
  itemCount: number; // total quantity
  uniqueProductCount: number;
  basketValue: number | null;
  categories: string[];
  products: string[];
}

export interface BasketAnalyticsResult {
  totalBaskets: number;
  avgBasketValue: number | null;
  medianBasketValue: number | null;
  minBasketValue: number | null;
  maxBasketValue: number | null;
  stdBasketValue: number | null;
  avgBasketSize: number;
  medianBasketSize: number;
  minBasketSize: number;
  maxBasketSize: number;
  totalItemsSold: number;
  totalRevenue: number | null;
  baskets: BasketSummary[];
}

export interface CategoryMetric {
  category: string;
  subcategories: { name: string; revenue: number | null; quantity: number; transactions: number }[];
  revenue: number | null;
  revenueSharePct: number | null;
  quantity: number;
  quantitySharePct: number;
  transactionCount: number;
  avgBasketContribution: number | null;
  uniqueProducts: number;
  growthPct: number | null;
}

export type VelocityTier = 'Fast-Moving' | 'Steady' | 'Slow-Moving';

export interface ProductMetric {
  productName: string;
  category: string;
  subcategory: string;
  tags: string[];
  totalRevenue: number | null;
  revenueSharePct: number | null;
  totalQuantity: number;
  quantitySharePct: number;
  transactionCount: number;
  basketPenetrationPct: number;
  avgUnitPrice: number | null;
  reorderRatePct: number | null;
  growthPct: number | null;
  velocityTier: VelocityTier;
  rank: number;
}

export type CustomerSegment = 'VIP' | 'Loyal' | 'Regular' | 'At-Risk' | 'Inactive';

export interface CustomerRFM {
  customerId: string;
  recencyValue: number; // days since last purchase OR avg days_since_prior_order
  recencyLabel: string;
  frequency: number; // unique transactions
  monetary: number | null; // total spend
  avgBasketValue: number | null;
  avgBasketSize: number;
  rScore: number;
  fScore: number;
  mScore: number | null;
  rfmComposite: number;
  segment: CustomerSegment;
  favoriteCategory: string;
  lastPurchaseDate: string | null;
}

export interface ShoppingPatternsResult {
  byDay: { dayIndex: number; dayName: string; orders: number; items: number; revenue: number | null; isWeekend: boolean }[];
  byHour: { hour: number; label: string; orders: number; items: number; revenue: number | null }[];
  weekdayVsWeekend: {
    weekdayOrders: number;
    weekendOrders: number;
    weekdayAvgSize: number;
    weekendAvgSize: number;
    weekdayAvgValue: number | null;
    weekendAvgValue: number | null;
    weekdayRevenueSharePct: number | null;
    weekendRevenueSharePct: number | null;
  };
  heatmapMatrix: {
    days: string[];
    hours: number[];
    zOrders: number[][];
    zRevenue: (number | null)[][];
  };
}

// Module 3 Types
export interface SalesTimePoint {
  period: string;
  label: string;
  revenue: number | null;
  quantity: number;
  transactions: number;
  avgBasketValue: number | null;
  growthPct: number | null;
}

export interface ForecastPoint {
  period: string;
  label: string;
  actual: number | null;
  forecast: number | null;
  lower80: number | null;
  upper80: number | null;
  lower95: number | null;
  upper95: number | null;
}

export interface ForecastResult {
  supported: boolean;
  unsupportedReason?: string;
  granularity: 'weekly' | 'monthly';
  modelName: string;
  modelDescription: string;
  horizonPeriods: number;
  mapePct: number;
  rmse: number;
  rSquared: number;
  trendSlopePerPeriod: number;
  points: ForecastPoint[];
}

export interface AnomalyPoint {
  id: string;
  period: string;
  metric: 'Revenue' | 'Transaction Volume' | 'Product Demand';
  entityName: string;
  actualValue: number;
  expectedValue: number;
  deviationPct: number;
  zScore: number;
  type: 'Spike' | 'Drop';
  severity: 'High' | 'Moderate';
  explanation: string;
}

export interface AssociationRule {
  id: string;
  antecedents: string[];
  consequents: string[];
  antecedentLabel: string;
  consequentLabel: string;
  antecedentSupport: number;
  consequentSupport: number;
  support: number;
  confidence: number;
  lift: number;
  leverage: number;
  conviction: number;
  coOccurrenceCount: number;
}

export interface NetworkNode {
  id: string;
  label: string;
  category: string;
  frequency: number;
  support: number;
  revenue: number | null;
  degree: number;
  x: number;
  y: number;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  support: number;
  confidence: number;
  lift: number;
  coOccurrence: number;
}

export interface CorrelogramData {
  categories: string[];
  matrix: number[][]; // Pearson correlation r in [-1, 1]
  strongestPositive: { catA: string; catB: string; r: number } | null;
  strongestNegative: { catA: string; catB: string; r: number } | null;
}

export type OpportunityQuadrant =
  | 'Stars (High Performance & Growth)'
  | 'Core Staples (High Volume, Mature)'
  | 'Rising Opportunities (Emerging Growth)'
  | 'Watchlist (Low Volume & Declining)';

export interface OpportunityPoint {
  productName: string;
  category: string;
  xValue: number; // Revenue or Transaction Frequency
  yValue: number; // Growth % or Reorder Rate %
  sizeValue: number; // Quantity
  quadrant: OpportunityQuadrant;
}

export interface RecommendationItem {
  id: string;
  type: 'Cross-Selling' | 'Product Bundle' | 'Category Promotion' | 'Inventory Action';
  title: string;
  summary: string;
  primaryProduct: string;
  relatedProducts: string[];
  category: string;
  metricsLabel: string;
  confidenceOrScore: number;
  rationale: string;
}

export interface SimulationConfig {
  targetScope: 'product' | 'category';
  productName: string;
  categoryName: string;
  discountPct: number;
  promotionType: 'Percentage Discount' | 'Bundle Offer (Buy 2 Get Discount)' | 'Featured Display Placement';
  durationDays: number;
}

export interface SimulationResult {
  isEstimate: true;
  elasticityUsed: number;
  baselineUnits: number;
  projectedUnits: number;
  unitLiftPct: number;
  baselineMetricValue: number; // Revenue if available, else Basket/Order count
  projectedMetricValue: number;
  netMetricDelta: number;
  netMetricDeltaPct: number;
  metricLabel: string;
  haloCrossSellLiftUnits: number;
  marginImpactNote: string;
  dailyComparison: { day: string; baseline: number; simulated: number }[];
}

export interface BusinessInsight {
  id: string;
  pillar:
    | 'Business Insights'
    | 'Retail Recommendations'
    | 'Forecasted Trends'
    | 'Anomaly Alerts'
    | 'Inventory Suggestions';
  title: string;
  summary: string;
  metricValue: string;
  severity: 'positive' | 'neutral' | 'warning' | 'alert';
  targetPage: PageId;
}

export interface AskDataResponse {
  query: string;
  matchedIntent: string;
  answerText: string;
  keyMetrics: { label: string; value: string }[];
  tableHeaders?: string[];
  tableRows?: (string | number)[][];
  chartSpec?: {
    title: string;
    xLabel: string;
    yLabel: string;
    labels: string[];
    values: number[];
    chartType: 'bar' | 'line';
  };
  followUpSuggestions: string[];
}
