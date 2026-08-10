import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/@/lib/utils';

interface ConnectionStatusBadgeProps {
  status?: string;
  loading?: boolean;
  className?: string;
}

const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  status,
  loading = false,
  className,
}) => {
  if (loading) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 justify-center text-xs font-semibold px-3 py-1 rounded-md bg-gray-200 text-gray-700',
          className
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Pending</span>
      </span>
    );
  }

  const normalized = (status || '').toString();
  const lower = normalized.toLowerCase();
  const cls =
    lower === 'live' || lower === 'up'
      ? 'bg-green-200 text-green-800'
      : lower === 'down'
        ? 'bg-red-200 text-red-800'
        : 'bg-yellow-100 text-yellow-800';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center text-xs font-semibold px-3 py-1 rounded-md',
        cls,
        className
      )}
    >
      {normalized || '-'}
    </span>
  );
};

export default ConnectionStatusBadge;
