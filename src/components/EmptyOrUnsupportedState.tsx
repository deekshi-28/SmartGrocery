import React from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { PageId } from '../types/analytics';
import { useAnalytics } from '../context/AnalyticsContext';

interface EmptyOrUnsupportedStateProps {
  title: string;
  description: string;
  suggestionLabel?: string;
  targetPage?: PageId;
}

export const EmptyOrUnsupportedState: React.FC<EmptyOrUnsupportedStateProps> = ({
  title,
  description,
  suggestionLabel,
  targetPage,
}) => {
  const { setActivePage } = useAnalytics();

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-2xl mx-auto my-6">
      <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-3">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{description}</p>
      {suggestionLabel && targetPage && (
        <button
          type="button"
          onClick={() => setActivePage(targetPage)}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
        >
          <span>{suggestionLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
