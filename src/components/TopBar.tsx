import React, { useMemo, useRef, useState } from 'react';
import {
  Bell,
  Calendar,
  ChevronDown,
  Database,
  FilterX,
  Menu,
  Search,
  User,
} from 'lucide-react';
import { NAV_ITEMS } from '../config/navigation';
import { useAnalytics } from '../context/AnalyticsContext';

interface TopBarProps {
  onOpenMobileMenu: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenMobileMenu }) => {
  const {
    activePage,
    setActivePage,
    datasets,
    activeDataset,
    selectDataset,
    capabilities,
    globalFilters,
    setGlobalFilters,
    resetGlobalFilters,
    availableDateBounds,
    availableCategories,
    productAnalytics,
    categoryAnalytics,
    anomalies,
    qualityReport,
    setSelectedProduct,
    setSelectedCategory,
  } = useAnalytics();

  const currentNav = NAV_ITEMS.find((n) => n.id === activePage) || NAV_ITEMS[0];

  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const hasActiveFilters =
    globalFilters.category !== 'ALL' ||
    globalFilters.dayType !== 'all' ||
    Boolean(globalFilters.dateStart) ||
    Boolean(globalFilters.dateEnd);

  const searchResults = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return { pages: [], products: [], categories: [] };
    return {
      pages: NAV_ITEMS.filter(
        (n) => n.label.toLowerCase().includes(q) || n.shortDesc.toLowerCase().includes(q)
      ).slice(0, 4),
      products: productAnalytics
        .filter((p) => p.productName.toLowerCase().includes(q))
        .slice(0, 5),
      categories: categoryAnalytics
        .filter((c) => c.category.toLowerCase().includes(q))
        .slice(0, 4),
    };
  }, [searchText, productAnalytics, categoryAnalytics]);

  const analyticalAlerts = useMemo(() => {
    const list: { id: string; title: string; detail: string; page: typeof activePage }[] = [];
    anomalies.slice(0, 3).forEach((a) => {
      list.push({
        id: a.id,
        title: `${a.type}: ${a.entityName} (${a.period})`,
        detail: a.explanation,
        page: 'anomalies',
      });
    });
    if (qualityReport.removedRows > 0) {
      list.push({
        id: 'dq-cleaned',
        title: `Data Quality: ${qualityReport.removedRows} records cleaned`,
        detail: `Score improved from ${qualityReport.qualityScoreBefore}% to ${qualityReport.qualityScoreAfter}%.`,
        page: 'quality',
      });
    }
    return list;
  }, [anomalies, qualityReport]);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-6">
      <div className="h-14 flex items-center justify-between gap-4">
        {/* Left: Mobile trigger + Current Page Title & Module */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900 truncate font-display">
              {currentNav.label}
            </h1>
            <p className="text-xs text-slate-500 truncate hidden sm:block">{currentNav.moduleTitle}</p>
          </div>
        </div>

        {/* Center/Right: Global Dataset Selector, Search, Alerts, Analyst Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Global Dataset Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Database className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <select
              aria-label="Global Dataset Selector"
              value={activeDataset.id}
              onChange={(e) => selectDataset(e.target.value)}
              className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer max-w-[190px] truncate"
            >
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name}
                </option>
              ))}
            </select>
          </div>

          {/* Global Search */}
          <div ref={searchRef} className="relative hidden md:block">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchText}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="Search products, categories, pages..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 w-56"
              />
            </div>

            {searchOpen && searchText.trim().length > 0 && (
              <div className="absolute right-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 max-h-96 overflow-y-auto">
                {searchResults.pages.length === 0 &&
                searchResults.products.length === 0 &&
                searchResults.categories.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 text-center">
                    No matching pages, categories, or products found.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.pages.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[11px] font-medium text-slate-400">Pages</div>
                        {searchResults.pages.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={() => {
                              setActivePage(p.id);
                              setSearchText('');
                            }}
                            className="w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-slate-100 text-slate-800 flex items-center justify-between"
                          >
                            <span className="font-medium">{p.label}</span>
                            <span className="text-[11px] text-slate-400">{p.group}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.categories.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[11px] font-medium text-slate-400">Categories</div>
                        {searchResults.categories.map((c) => (
                          <button
                            key={c.category}
                            type="button"
                            onMouseDown={() => {
                              setSelectedCategory(c.category);
                              setActivePage('categories');
                              setSearchText('');
                            }}
                            className="w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-slate-100 text-slate-800 flex items-center justify-between"
                          >
                            <span className="font-medium">{c.category}</span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {c.transactionCount} baskets
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.products.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[11px] font-medium text-slate-400">Products</div>
                        {searchResults.products.map((pr) => (
                          <button
                            key={pr.productName}
                            type="button"
                            onMouseDown={() => {
                              setSelectedProduct(pr.productName);
                              setActivePage('products');
                              setSearchText('');
                            }}
                            className="w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-slate-100 text-slate-800 flex items-center justify-between gap-2"
                          >
                            <span className="font-medium truncate">{pr.productName}</span>
                            <span className="text-[11px] text-slate-400 shrink-0">{pr.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Analytical Alerts Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setAlertsOpen((v) => !v);
                setProfileOpen(false);
              }}
              aria-label="Analytical Alerts"
              className="relative p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              <Bell className="w-4 h-4" />
              {analyticalAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-teal-700 text-white text-[10px] font-mono flex items-center justify-center">
                  {analyticalAlerts.length}
                </span>
              )}
            </button>

            {alertsOpen && (
              <div className="absolute right-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-900">Analytical Alerts</span>
                  <span className="text-[11px] text-slate-500">{activeDataset.name}</span>
                </div>
                <div className="mt-2 space-y-2 max-h-72 overflow-y-auto">
                  {analyticalAlerts.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">No active alerts for this dataset.</p>
                  ) : (
                    analyticalAlerts.map((al) => (
                      <button
                        key={al.id}
                        type="button"
                        onClick={() => {
                          setActivePage(al.page);
                          setAlertsOpen(false);
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors"
                      >
                        <div className="text-xs font-medium text-slate-900">{al.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{al.detail}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Analyst Profile Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((v) => !v);
                setAlertsOpen(false);
              }}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <span className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center">
                <User className="w-3 h-3" />
              </span>
              <span className="hidden sm:inline">Retail Analyst</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 text-xs">
                <div className="font-semibold text-slate-900">Retail Operations Analyst</div>
                <div className="text-slate-500 mt-0.5">Active: {activeDataset.name}</div>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1 text-slate-600">
                  <div>Monetary Metrics: {capabilities.hasRevenue ? 'Enabled' : 'Disabled (No Price)'}</div>
                  <div>Calendar Forecasting: {capabilities.hasDate ? 'Enabled' : 'Disabled (No Dates)'}</div>
                  <div>Quality Score: {qualityReport.qualityScoreAfter}%</div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage('datasets');
                      setProfileOpen(false);
                    }}
                    className="flex-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-medium"
                  >
                    Datasets
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage('reports');
                      setProfileOpen(false);
                    }}
                    className="flex-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium"
                  >
                    Export
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compact Global Filter Ribbon */}
      <div className="py-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500 font-medium">Global Filters:</span>

          <select
            aria-label="Global Category Filter"
            value={globalFilters.category}
            onChange={(e) => setGlobalFilters((prev) => ({ ...prev, category: e.target.value }))}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-teal-600"
          >
            <option value="ALL">All Categories ({availableCategories.length})</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Weekday or Weekend Filter"
            value={globalFilters.dayType}
            onChange={(e) =>
              setGlobalFilters((prev) => ({
                ...prev,
                dayType: e.target.value as 'all' | 'weekday' | 'weekend',
              }))
            }
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-teal-600"
          >
            <option value="all">All Days</option>
            <option value="weekday">Weekdays Only</option>
            <option value="weekend">Weekends Only</option>
          </select>

          {capabilities.hasDate && availableDateBounds && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                aria-label="Filter start date"
                min={availableDateBounds.min}
                max={availableDateBounds.max}
                value={globalFilters.dateStart || availableDateBounds.min}
                onChange={(e) => setGlobalFilters((prev) => ({ ...prev, dateStart: e.target.value }))}
                className="bg-transparent text-slate-700 font-mono text-[11px] focus:outline-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                aria-label="Filter end date"
                min={availableDateBounds.min}
                max={availableDateBounds.max}
                value={globalFilters.dateEnd || availableDateBounds.max}
                onChange={(e) => setGlobalFilters((prev) => ({ ...prev, dateEnd: e.target.value }))}
                className="bg-transparent text-slate-700 font-mono text-[11px] focus:outline-none"
              />
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetGlobalFilters}
              className="inline-flex items-center gap-1 px-2 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              <FilterX className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>

        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
          {capabilities.hasRevenue ? 'Revenue & Basket Value Active' : 'Volume & Association Mode (No Price Columns)'}
        </div>
      </div>
    </header>
  );
};
