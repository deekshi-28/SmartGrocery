import { PageId } from '../types/analytics';

export interface NavItem {
  id: PageId;
  label: string;
  shortDesc: string;
  group: 'Overview' | 'Module 1' | 'Module 2' | 'Module 3' | 'Export';
  moduleTitle: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Home Dashboard',
    shortDesc: 'Executive KPIs, system flow & Decision Intelligence Layer',
    group: 'Overview',
    moduleTitle: 'Executive Overview',
  },
  {
    id: 'datasets',
    label: 'Dataset Management',
    shortDesc: 'Upload CSV/Excel, switch datasets & map columns',
    group: 'Module 1',
    moduleTitle: 'Module 1: Transaction Data Preprocessing & Product Tagging',
  },
  {
    id: 'preprocessing',
    label: 'Data Preprocessing',
    shortDesc: 'Cleaning pipeline, standardization & taxonomy tagging',
    group: 'Module 1',
    moduleTitle: 'Module 1: Transaction Data Preprocessing & Product Tagging',
  },
  {
    id: 'quality',
    label: 'Data Quality',
    shortDesc: 'Before/after quality scores, missingness & duplicates',
    group: 'Module 1',
    moduleTitle: 'Module 1: Transaction Data Preprocessing & Product Tagging',
  },
  {
    id: 'baskets',
    label: 'Basket Analytics',
    shortDesc: 'Basket value & size distributions, histograms & violin plots',
    group: 'Module 2',
    moduleTitle: 'Module 2: Basket Value Distribution & Category Proportion',
  },
  {
    id: 'categories',
    label: 'Category Analytics',
    shortDesc: 'Interactive treemap, category shares & subcategory drill-down',
    group: 'Module 2',
    moduleTitle: 'Module 2: Basket Value Distribution & Category Proportion',
  },
  {
    id: 'products',
    label: 'Product Analytics',
    shortDesc: 'Fast/slow-moving SKUs, rankings & product drill-down',
    group: 'Module 2',
    moduleTitle: 'Module 2: Basket Value Distribution & Category Proportion',
  },
  {
    id: 'customers',
    label: 'Customer Analytics',
    shortDesc: 'RFM segmentation (VIP, Loyal, Regular, At-Risk, Inactive)',
    group: 'Module 2',
    moduleTitle: 'Module 2: Basket Value Distribution & Category Proportion',
  },
  {
    id: 'patterns',
    label: 'Shopping Patterns',
    shortDesc: 'Day-of-week, hourly trends, weekend split & activity heatmap',
    group: 'Module 2',
    moduleTitle: 'Module 2: Basket Value Distribution & Category Proportion',
  },
  {
    id: 'sales',
    label: 'Sales Analytics',
    shortDesc: 'Daily, weekly & monthly revenue, quantity & growth trends',
    group: 'Module 3',
    moduleTitle: 'Module 3: Sales Trend & Product Association',
  },
  {
    id: 'market-basket',
    label: 'Market Basket Analysis',
    shortDesc: 'Apriori association rules with support, confidence & lift',
    group: 'Module 3',
    moduleTitle: 'Module 3: Sales Trend & Product Association',
  },
  {
    id: 'network',
    label: 'Product Network',
    shortDesc: 'Interactive force-directed product association graph',
    group: 'Module 3',
    moduleTitle: 'Module 3: Sales Trend & Product Association',
  },
  {
    id: 'forecasting',
    label: 'Forecasting',
    shortDesc: 'Time-series demand forecasting with confidence intervals',
    group: 'Module 3',
    moduleTitle: 'Module 3: Sales Trend & Product Association',
  },
  {
    id: 'anomalies',
    label: 'Anomaly Detection',
    shortDesc: 'Statistical spike & drop detection with Z-score diagnostics',
    group: 'Module 3',
    moduleTitle: 'Module 3: Sales Trend & Product Association',
  },
  {
    id: 'recommendations',
    label: 'Recommendations',
    shortDesc: 'Cross-selling, product bundles & category promo engine',
    group: 'Module 3',
    moduleTitle: 'Module 3: Sales Trend & Product Association',
  },
  {
    id: 'simulator',
    label: 'Promotion Simulator',
    shortDesc: 'What-If discount & bundle impact estimation lab',
    group: 'Module 3',
    moduleTitle: 'Module 3: Sales Trend & Product Association',
  },
  {
    id: 'ask-data',
    label: 'Ask the Data',
    shortDesc: 'Natural-language analytical query engine over live metrics',
    group: 'Module 3',
    moduleTitle: 'Module 3: Sales Trend & Product Association',
  },
  {
    id: 'reports',
    label: 'Reports & Export',
    shortDesc: 'Export cleaned data, rules, quality audits & summaries',
    group: 'Export',
    moduleTitle: 'Reporting & Export',
  },
];

export const NAV_GROUPS: { key: NavItem['group']; heading: string }[] = [
  { key: 'Overview', heading: 'Executive' },
  { key: 'Module 1', heading: 'Module 1 · Preprocessing & Tagging' },
  { key: 'Module 2', heading: 'Module 2 · Basket & Category' },
  { key: 'Module 3', heading: 'Module 3 · Trends & Associations' },
  { key: 'Export', heading: 'Export & Documentation' },
];
