import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

interface PlotlyChartProps {
  data: Record<string, unknown>[];
  layout?: Record<string, unknown>;
  config?: Record<string, unknown>;
  height?: number;
  className?: string;
  onPointClick?: (eventData: any) => void;
}

export const PlotlyChart: React.FC<PlotlyChartProps> = ({
  data,
  layout = {},
  config = {},
  height = 340,
  className = '',
  onPointClick,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mergedLayout: Record<string, unknown> = {
      autosize: true,
      height,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: {
        family: "'DM Sans', system-ui, -apple-system, sans-serif",
        color: '#334155',
        size: 12,
      },
      margin: { l: 52, r: 20, t: 36, b: 48 },
      hoverlabel: {
        bgcolor: '#0f172a',
        bordercolor: '#0f172a',
        font: { color: '#f8fafc', size: 12, family: "'DM Sans', sans-serif" },
      },
      ...layout,
    };

    const mergedConfig: Record<string, unknown> = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
      ...config,
    };

    let cancelled = false;

    Plotly.react(el, data, mergedLayout, mergedConfig).then((gd) => {
      if (cancelled || !gd) return;
      if (onPointClick && typeof gd.on === 'function') {
        gd.on('plotly_click', onPointClick);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        try {
          Plotly.Plots.resize(containerRef.current);
        } catch {
          // ignore resize during unmount
        }
      }
    });
    resizeObserver.observe(el);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
    };
  }, [data, layout, config, height, onPointClick]);

  useEffect(() => {
    const el = containerRef.current;
    return () => {
      if (el) {
        try {
          Plotly.purge(el);
        } catch {
          // ignore cleanup error
        }
      }
    };
  }, []);

  return <div ref={containerRef} className={`w-full ${className}`} style={{ minHeight: height }} />;
};
