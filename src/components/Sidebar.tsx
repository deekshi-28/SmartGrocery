import React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Database,
  FileSpreadsheet,
  GitBranch,
  Home,
  Layers,
  Lightbulb,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  ShoppingBasket,
  Sliders,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
} from 'lucide-react';
import { NAV_GROUPS, NAV_ITEMS } from '../config/navigation';
import { PageId } from '../types/analytics';
import { useAnalytics } from '../context/AnalyticsContext';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const PAGE_ICONS: Record<PageId, React.ComponentType<{ className?: string }>> = {
  home: Home,
  datasets: Database,
  preprocessing: Wand2,
  quality: ShieldCheck,
  baskets: ShoppingBasket,
  categories: Layers,
  products: Package,
  customers: Users,
  patterns: Clock,
  sales: BarChart3,
  'market-basket': Sparkles,
  network: GitBranch,
  forecasting: TrendingUp,
  anomalies: AlertTriangle,
  recommendations: Lightbulb,
  simulator: Sliders,
  'ask-data': MessageSquare,
  reports: FileSpreadsheet,
};

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { activePage, setActivePage, activeDataset } = useAnalytics();

  const handleSelect = (id: PageId) => {
    setActivePage(id);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-200 border-r border-slate-800 transition-all duration-200 shrink-0 ${
          collapsed ? 'w-16' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => handleSelect('home')}
            className="flex items-center gap-2.5 text-left min-w-0"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white tracking-tight truncate font-display">
                  SmartGrocery
                </div>
                <div className="text-[11px] text-slate-400 truncate">Retail Intelligence</div>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:inline-flex p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_GROUPS.map((group) => {
            const items = NAV_ITEMS.filter((item) => item.group === group.key);
            return (
              <div key={group.key}>
                {!collapsed && (
                  <div className="px-2.5 mb-1.5 text-[11px] font-medium text-slate-400 tracking-wide truncate">
                    {group.heading}
                  </div>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = PAGE_ICONS[item.id];
                    const isActive = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        title={collapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-teal-600/20 text-teal-300'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-teal-400' : 'text-slate-400'
                          }`}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Active Dataset Context Footer */}
        {!collapsed && (
          <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-xs">
            <div className="text-slate-400">Active Source</div>
            <div className="mt-0.5 font-medium text-slate-100 truncate">{activeDataset.name}</div>
            <div className="mt-0.5 text-[11px] text-slate-400 font-mono tabular-nums">
              {activeDataset.rawRows.length.toLocaleString()} raw rows
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
