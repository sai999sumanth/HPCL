import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/@/lib/utils';
import { ArrowUpRight } from 'lucide-react';

const cardVariants = cva(
  'bg-white rounded-lg p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 text-center border flex flex-col justify-center',
  {
    variants: {
      variant: {
        default: 'border-blue-400',
        success: 'border-green-400',
        warning: 'border-orange-400',
        danger: 'border-red-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface MetricCardProps extends VariantProps<typeof cardVariants> {
  title: string;
  value: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, variant, className, onClick }) => {
  const isComingSoon = typeof value === 'string' && value.toLowerCase() === 'coming soon';

  return (
    <div
      className={cn(
        cardVariants({ variant }),
        onClick ? 'cursor-pointer hover:opacity-80' : '',
        isComingSoon ? 'border-red-500' : 'border-blue-500', // 🔴 Red if coming soon, 🔵 Blue otherwise
        'relative group',
        className
      )}
      onClick={onClick}
    >
      {/* Top-right arrow icon for clickable cards */}
      {onClick && (
        <div className="absolute top-2 right-2">
          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <ArrowUpRight className="w-3 h-3 text-blue-600" />
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500 mb-1 truncate" title={title}>
        {title}
      </p>

      <div
        className={cn(
          'h-9 flex items-center justify-center',
          isComingSoon
            ? 'text-sm font-medium text-gray-400'
            : 'text-3xl font-bold text-gray-800'
        )}
      >
        {value}
      </div>
    </div>
  );
};

export default MetricCard;