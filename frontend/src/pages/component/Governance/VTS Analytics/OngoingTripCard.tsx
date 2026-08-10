import React from 'react';
import { cn } from '@/@/lib/utils';

interface OngoingTripCardProps {
  description: string;
  value: number | string;
  className?: string;
  onClick?: () => void;
}

const OngoingTripCard: React.FC<OngoingTripCardProps> = ({ description, value, className, onClick }) => {
  const isComingSoon = typeof value === 'string' && value.toLowerCase() === 'coming soon';
  
  return (
    <div
      className={cn(
        'bg-white rounded-lg p-3 shadow-sm text-center border border-gray-200 flex flex-col justify-between h-full cursor-pointer',
        className
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <p className={cn(
        "my-2",
        isComingSoon 
          ? "text-sm font-medium text-gray-400" 
          : "text-3xl font-bold text-gray-900"
      )}>{value}</p>
      <p className="text-xs text-gray-700 leading-tight">{description}</p>
    </div>
  );
};

export default OngoingTripCard;
