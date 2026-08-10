import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/@/lib/utils';

interface ComplianceCardProps {
  title: string;
  value: number | null;
  loading: boolean;
  error: boolean;
}

const ComplianceCard: React.FC<ComplianceCardProps> = ({ title, value, loading, error }) => {
  const getValueColor = () => {
    if (value === null || error) return 'text-gray-500';
    if (value >= 95) return 'text-green-600';
    if (value >= 85) return 'text-orange-500';
    return 'text-red-600';
  };

  const renderValue = () => {
    if (loading) {
      return <Loader2 className="h-8 w-8 animate-spin text-gray-400" />;
    }
    if (error || value === null) {
      return <span className="text-2xl font-bold text-gray-400">N/A</span>;
    }
    return (
      <span className={cn('text-4xl font-bold', getValueColor())}>
        {value}<span className="text-2xl">%</span>
      </span>
    );
  };

  return (
    <div className="bg-slate-50 rounded-lg p-4 shadow-sm border border-gray-200 text-center flex flex-col items-center justify-center h-full">
      <p className="text-sm font-semibold text-gray-700 mb-2">{title}</p>
      {renderValue()}
    </div>
  );
};

export default ComplianceCard;
