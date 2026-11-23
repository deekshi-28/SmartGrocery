import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  AnomalyPoint,
  AssociationRule,
  BasketAnalyticsResult,
  BusinessInsight,
  CategoryMetric,
  CleanedTransaction,
  CleaningConfig,
  ColumnMapping,
  CorrelogramData,
  CustomerRFM,
  DataQualityReport,
  DatasetCapabilities,
  DatasetSource,
  ForecastResult,
  NetworkEdge,
  NetworkNode,
  OpportunityPoint,
  PageId,
  ProductMetric,
  RawRow,
  RecommendationItem,
  SalesTimePoint,
  ShoppingPatternsResult,
} from '../types/analytics';
import { buildInstacartDataset, buildUciRetailDataset } from '../data/sampleDatasets';
import { detectDatasetCapabilities } from '../analytics/fileParser';
import { runPreprocessingPipeline } from '../analytics/preprocessing';
import {
  computeBasketAnalytics,
  computeCategoryAnalytics,
  computeCustomerRFM,
  computeProductAnalytics,
  computeShoppingPatterns,
} from '../analytics/module2';
import {
  buildProductNetwork,
  computeAnomalies,
  computeCategoryCorrelogram,
  computeMarketBasket,
  computeProductOpportunityMatrix,
  computeSalesForecast,
  computeSalesTrends,
} from '../analytics/module3';
import { computeBusinessInsights, computeRecommendations } from '../analytics/intelligence';

export interface GlobalFilters {
  dateStart: string;
  dateEnd: string;
  category: string; // 'ALL' or category name
  dayType: 'all' | 'weekday' | 'weekend';
}

export interface MbaConfig {
  minSupport: number;
  minConfidence: number;
  minLift: number;
  maxRules: number;
}

export interface ForecastConfig {
  granularity: 'weekly' | 'monthly';
  horizonPeriods: number;
  modelType: 'holt' | 'linear';
}

interface AnalyticsContextValue {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  datasets: DatasetSource[];
  activeDataset: DatasetSource;
  selectDataset: (id: string) => void;
  addUploadedDataset: (ds: DatasetSource) => void;
  updateDatasetMapping: (datasetId: string, mapping: ColumnMapping) => void;
  updateCleaningConfig: (datasetId: string, config: CleaningConfig) => void;
  capabilities: DatasetCapabilities;
  qualityReport: DataQualityReport;
  cleanedTransactions: CleanedTransaction[];
  filteredTransactions: CleanedTransaction[];
  cleanedPreviewRows: RawRow[];
  globalFilters: GlobalFilters;
  setGlobalFilters: React.Dispatch<React.SetStateAction<GlobalFilters>>;
  resetGlobalFilters: () => void;
  availableDateBounds: { min: string; max: string } | null;
  availableCategories: string[];
  // Module 2
  basketAnalytics: BasketAnalyticsResult;
  categoryAnalytics: CategoryMetric[];
  productAnalytics: ProductMetric[];
  shoppingPatterns: ShoppingPatternsResult;
  customerRFM: CustomerRFM[];
  // Module 3
  salesDaily: SalesTimePoint[];
  salesWeekly: SalesTimePoint[];
  salesMonthly: SalesTimePoint[];
  mbaConfig: MbaConfig;
  setMbaConfig: React.Dispatch<React.SetStateAction<MbaConfig>>;
  marketBasket: {
    rules: AssociationRule[];
    frequentPairs: { items: [string, string]; count: number; support: number }[];
    frequentTriples: { items: [string, string, string]; count: number; support: number }[];
    totalBaskets: number;
  };
  productNetwork: { nodes: NetworkNode[]; edges: NetworkEdge[] };
  correlogram: CorrelogramData;
  opportunityMatrix: {
    points: OpportunityPoint[];
    xAxisLabel: string;
    yAxisLabel: string;
    xMedian: number;
    yMedian: number;
  };
  forecastConfig: ForecastConfig;
  setForecastConfig: React.Dispatch<React.SetStateAction<ForecastConfig>>;
  forecastResult: ForecastResult;
  anomalyThreshold: number;
  setAnomalyThreshold: React.Dispatch<React.SetStateAction<number>>;
  anomalies: AnomalyPoint[];
  // Decision Intelligence
  recommendations: RecommendationItem[];
  businessInsights: BusinessInsight[];
  // Drill-downs
  selectedProduct: string | null;
  setSelectedProduct: (name: string | null) => void;
  selectedCategory: string | null;
  setSelectedCategory: (name: string | null) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [datasets, setDatasets] = useState<DatasetSource[]>(() => [
    buildUciRetailDataset(),
    buildInstacartDataset(),
  ]);
  const [activeDatasetId, setActiveDatasetId] = useState<string>('uci_retail');
  const [activePage, setActivePage] = useState<PageId>('home');

  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>({
    dateStart: '',
    dateEnd: '',
    category: 'ALL',
    dayType: 'all',
  });

  const [mbaConfig, setMbaConfig] = useState<MbaConfig>({
    minSupport: 0.015,
    minConfidence: 0.22,
    minLift: 1.15,
    maxRules: 80,
  });

  const [forecastConfig, setForecastConfig] = useState<ForecastConfig>({
    granularity: 'weekly',
    horizonPeriods: 8,
    modelType: 'holt',
  });

  const [anomalyThreshold, setAnomalyThreshold] = useState<number>(2.0);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === activeDatasetId) || datasets[0],
    [datasets, activeDatasetId]
  );

  const selectDataset = (id: string) => {
    setActiveDatasetId(id);
    setGlobalFilters({ dateStart: '', dateEnd: '', category: 'ALL', dayType: 'all' });
    setSelectedProduct(null);
    setSelectedCategory(null);
  };

  const addUploadedDataset = (ds: DatasetSource) => {
    setDatasets((prev) => [...prev, ds]);
    setActiveDatasetId(ds.id);
    setGlobalFilters({ dateStart: '', dateEnd: '', category: 'ALL', dayType: 'all' });
    setSelectedProduct(null);
    setSelectedCategory(null);
  };

  const updateDatasetMapping = (datasetId: string, mapping: ColumnMapping) => {
    setDatasets((prev) =>
      prev.map((ds) => (ds.id === datasetId ? { ...ds, mapping } : ds))
    );
  };

  const updateCleaningConfig = (datasetId: string, cleaningConfig: CleaningConfig) => {
    setDatasets((prev) =>
      prev.map((ds) => (ds.id === datasetId ? { ...ds, cleaningConfig } : ds))
    );
  };

  const resetGlobalFilters = () => {
    setGlobalFilters({ dateStart: '', dateEnd: '', category: 'ALL', dayType: 'all' });
  };

  // Capabilities
  const capabilities = useMemo(
    () => detectDatasetCapabilities(activeDataset.mapping, activeDataset.rawRows),
    [activeDataset.mapping, activeDataset.rawRows]
  );

  // Module 1 Preprocessing
  const preprocessing = useMemo(
    () =>
      runPreprocessingPipeline(
        activeDataset.rawRows,
        activeDataset.columns,
        activeDataset.mapping,
        capabilities,
        activeDataset.cleaningConfig
      ),
    [
      activeDataset.rawRows,
      activeDataset.columns,
      activeDataset.mapping,
      capabilities,
      activeDataset.cleaningConfig,
    ]
  );

  const cleanedTransactions = preprocessing.cleanedTransactions;

  const availableDateBounds = useMemo(() => {
    if (!capabilities.hasDate) return null;
    const dates = cleanedTransactions
      .map((t) => t.purchaseDate)
      .filter((d): d is string => Boolean(d))
      .sort();
    if (dates.length === 0) return null;
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [cleanedTransactions, capabilities.hasDate]);

  const availableCategories = useMemo(() => {
    const set = new Set(cleanedTransactions.map((t) => t.category));
    return Array.from(set).sort();
  }, [cleanedTransactions]);

  // Apply Global Filters
  const filteredTransactions = useMemo(() => {
    return cleanedTransactions.filter((tx) => {
      if (globalFilters.category !== 'ALL' && tx.category !== globalFilters.category) {
        return false;
      }
      if (capabilities.hasDate && tx.purchaseDate) {
        if (globalFilters.dateStart && tx.purchaseDate < globalFilters.dateStart) return false;
        if (globalFilters.dateEnd && tx.purchaseDate > globalFilters.dateEnd) return false;
      }
      if (globalFilters.dayType === 'weekend' && tx.isWeekend !== true) return false;
      if (globalFilters.dayType === 'weekday' && tx.isWeekend !== false) return false;
      return true;
    });
  }, [cleanedTransactions, globalFilters, capabilities.hasDate]);

  // Module 2 Analytics
  const basketAnalytics = useMemo(
    () => computeBasketAnalytics(filteredTransactions, capabilities),
    [filteredTransactions, capabilities]
  );

  const categoryAnalytics = useMemo(
    () => computeCategoryAnalytics(filteredTransactions, capabilities),
    [filteredTransactions, capabilities]
  );

  const productAnalytics = useMemo(
    () => computeProductAnalytics(filteredTransactions, capabilities, basketAnalytics.totalBaskets),
    [filteredTransactions, capabilities, basketAnalytics.totalBaskets]
  );

  const shoppingPatterns = useMemo(
    () => computeShoppingPatterns(filteredTransactions, basketAnalytics.baskets, capabilities),
    [filteredTransactions, basketAnalytics.baskets, capabilities]
  );

  const customerRFM = useMemo(
    () => computeCustomerRFM(filteredTransactions, capabilities),
    [filteredTransactions, capabilities]
  );

  // Module 3 Analytics
  const salesDaily = useMemo(
    () => computeSalesTrends(filteredTransactions, capabilities, 'daily'),
    [filteredTransactions, capabilities]
  );

  const salesWeekly = useMemo(
    () => computeSalesTrends(filteredTransactions, capabilities, 'weekly'),
    [filteredTransactions, capabilities]
  );

  const salesMonthly = useMemo(
    () => computeSalesTrends(filteredTransactions, capabilities, 'monthly'),
    [filteredTransactions, capabilities]
  );

  const marketBasket = useMemo(
    () => computeMarketBasket(filteredTransactions, mbaConfig),
    [filteredTransactions, mbaConfig]
  );

  const productNetwork = useMemo(
    () =>
      buildProductNetwork(
        marketBasket.rules,
        productAnalytics,
        marketBasket.totalBaskets,
        45
      ),
    [marketBasket.rules, productAnalytics, marketBasket.totalBaskets]
  );

  const correlogram = useMemo(
    () => computeCategoryCorrelogram(filteredTransactions, capabilities),
    [filteredTransactions, capabilities]
  );

  const opportunityMatrix = useMemo(
    () => computeProductOpportunityMatrix(productAnalytics, capabilities),
    [productAnalytics, capabilities]
  );

  const forecastResult = useMemo(
    () =>
      computeSalesForecast(
        filteredTransactions,
        capabilities,
        forecastConfig.granularity,
        forecastConfig.horizonPeriods,
        forecastConfig.modelType
      ),
    [filteredTransactions, capabilities, forecastConfig]
  );

  const anomalies = useMemo(
    () => computeAnomalies(filteredTransactions, capabilities, anomalyThreshold),
    [filteredTransactions, capabilities, anomalyThreshold]
  );

  // Decision Intelligence Layer
  const recommendations = useMemo(
    () =>
      computeRecommendations(
        marketBasket.rules,
        marketBasket.frequentTriples,
        productAnalytics,
        categoryAnalytics,
        capabilities
      ),
    [
      marketBasket.rules,
      marketBasket.frequentTriples,
      productAnalytics,
      categoryAnalytics,
      capabilities,
    ]
  );

  const businessInsights = useMemo(
    () =>
      computeBusinessInsights(
        basketAnalytics,
        categoryAnalytics,
        productAnalytics,
        marketBasket.rules,
        forecastResult,
        anomalies,
        shoppingPatterns,
        capabilities,
        activeDataset.currencySymbol
      ),
    [
      basketAnalytics,
      categoryAnalytics,
      productAnalytics,
      marketBasket.rules,
      forecastResult,
      anomalies,
      shoppingPatterns,
      capabilities,
      activeDataset.currencySymbol,
    ]
  );

  return (
    <AnalyticsContext.Provider
      value={{
        activePage,
        setActivePage,
        datasets,
        activeDataset,
        selectDataset,
        addUploadedDataset,
        updateDatasetMapping,
        updateCleaningConfig,
        capabilities,
        qualityReport: preprocessing.qualityReport,
        cleanedTransactions,
        filteredTransactions,
        cleanedPreviewRows: preprocessing.cleanedPreviewRows,
        globalFilters,
        setGlobalFilters,
        resetGlobalFilters,
        availableDateBounds,
        availableCategories,
        basketAnalytics,
        categoryAnalytics,
        productAnalytics,
        shoppingPatterns,
        customerRFM,
        salesDaily,
        salesWeekly,
        salesMonthly,
        mbaConfig,
        setMbaConfig,
        marketBasket,
        productNetwork,
        correlogram,
        opportunityMatrix,
        forecastConfig,
        setForecastConfig,
        forecastResult,
        anomalyThreshold,
        setAnomalyThreshold,
        anomalies,
        recommendations,
        businessInsights,
        selectedProduct,
        setSelectedProduct,
        selectedCategory,
        setSelectedCategory,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
};

export function useAnalytics(): AnalyticsContextValue {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error('useAnalytics must be used inside AnalyticsProvider');
  return ctx;
}
