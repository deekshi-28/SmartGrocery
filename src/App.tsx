import React, { useState } from 'react';
import { AnalyticsProvider, useAnalytics } from './context/AnalyticsContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { HomeDashboardPage } from './pages/HomeDashboardPage';
import { DatasetManagementPage } from './pages/DatasetManagementPage';
import { DataPreprocessingPage } from './pages/DataPreprocessingPage';
import { DataQualityPage } from './pages/DataQualityPage';
import { BasketAnalyticsPage } from './pages/BasketAnalyticsPage';
import { CategoryAnalyticsPage } from './pages/CategoryAnalyticsPage';
import { ProductAnalyticsPage } from './pages/ProductAnalyticsPage';
import { CustomerAnalyticsPage } from './pages/CustomerAnalyticsPage';
import { ShoppingPatternsPage } from './pages/ShoppingPatternsPage';
import { SalesAnalyticsPage } from './pages/SalesAnalyticsPage';
import { MarketBasketPage } from './pages/MarketBasketPage';
import { ProductNetworkPage } from './pages/ProductNetworkPage';
import { ForecastingPage } from './pages/ForecastingPage';
import { AnomalyDetectionPage } from './pages/AnomalyDetectionPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { PromotionSimulatorPage } from './pages/PromotionSimulatorPage';
import { AskTheDataPage } from './pages/AskTheDataPage';
import { ReportsExportPage } from './pages/ReportsExportPage';

const WorkspaceShell: React.FC = () => {
  const { activePage } = useAnalytics();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <HomeDashboardPage />;
      case 'datasets':
        return <DatasetManagementPage />;
      case 'preprocessing':
        return <DataPreprocessingPage />;
      case 'quality':
        return <DataQualityPage />;
      case 'baskets':
        return <BasketAnalyticsPage />;
      case 'categories':
        return <CategoryAnalyticsPage />;
      case 'products':
        return <ProductAnalyticsPage />;
      case 'customers':
        return <CustomerAnalyticsPage />;
      case 'patterns':
        return <ShoppingPatternsPage />;
      case 'sales':
        return <SalesAnalyticsPage />;
      case 'market-basket':
        return <MarketBasketPage />;
      case 'network':
        return <ProductNetworkPage />;
      case 'forecasting':
        return <ForecastingPage />;
      case 'anomalies':
        return <AnomalyDetectionPage />;
      case 'recommendations':
        return <RecommendationsPage />;
      case 'simulator':
        return <PromotionSimulatorPage />;
      case 'ask-data':
        return <AskTheDataPage />;
      case 'reports':
        return <ReportsExportPage />;
      default:
        return <HomeDashboardPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AnalyticsProvider>
      <WorkspaceShell />
    </AnalyticsProvider>
  );
}
