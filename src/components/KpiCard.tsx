import React from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  trendText?: string;
  trendTone?: 'positive' | 'negative' | 'neutral';
  unavailable?: boolean;
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subtext,
  trendText,
  trendTone = 'neutral',
  unavailable = false,
  onClick,
}) => {
  const toneClass =
    trendTone === 'positive'
      ? 'text-emerald-700'
      : trendTone === 'negative'
        ? 'text-rose-700'
        : 'text-slate-500';

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`text-left bg-white border border-slate-200 rounded-xl p-4 transition-colors ${
        onClick ? 'hover:border-teal-500 cursor-pointer' : ''
      } ${unavailable ? 'bg-slate-50/70' : ''}`}
    >
      <div className="text-xs font-medium text-slate-500 truncate">{label}</div>
      <div
        className={`mt-1.5 text-2xl font-semibold tracking-tight font-mono tabular-nums ${
          unavailable ? 'text-slate-400 text-lg' : 'text-slate-900'
        }`}
      >
        {value}
      </div>
      {(subtext || trendText) && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {trendText && <span className={`font-medium tabular-nums ${toneClass}`}>{trendText}</span>}
          {trendText && subtext && <span className="text-slate-300" aria-hidden="true">·</span>}
          {subtext && <span className="text-slate-500 truncate">{subtext}</span>}
        </div>
      )}
    </Wrapper>
  );
};
