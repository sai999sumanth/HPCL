import React from 'react';
import { cn } from '@/@/lib/utils';
import type { DbType } from '../types';
import { DB_TYPE_ICONS } from '../utils/dbTypeIcons';
import { normalizeDbTypeWithDefault } from '../utils/normalizeDbType';

export { DB_TYPE_ICONS } from '../utils/dbTypeIcons';

const DB_ICONS = DB_TYPE_ICONS;

type DbTypeIconVariant = 'default' | 'compact';

const ICON_SIZE: Record<
  DbTypeIconVariant,
  Record<DbType, { className: string }>
> = {
  default: {
    PostgreSQL: { className: 'h-[22px] w-[22px] min-h-[22px] min-w-[22px]' },
    MySQL: { className: 'h-[44px] w-auto min-h-[44px] max-w-none' },
  },
  compact: {
    PostgreSQL: { className: 'h-[22px] w-[22px] min-h-[22px] min-w-[22px]' },
    MySQL: { className: 'h-[32px] w-auto min-h-[32px] max-w-none' },
  },
};

function DbTypeIcon({ dbType, variant }: { dbType: DbType; variant: DbTypeIconVariant }) {
  const { className } = ICON_SIZE[variant][dbType];

  return (
    <img
      src={DB_ICONS[dbType]}
      alt={dbType}
      title={dbType}
      className={cn('block shrink-0 object-contain object-left', className)}
    />
  );
}

interface DbTypeLabelProps {
  dbType: DbType | string;
  variant?: DbTypeIconVariant;
  className?: string;
  showLabel?: boolean;
  labelClassName?: string;
}

const DbTypeLabel: React.FC<DbTypeLabelProps> = ({
  dbType,
  variant = 'default',
  className,
  showLabel = false,
  labelClassName = 'text-sm text-gray-700',
}) => {
  const resolved = normalizeDbTypeWithDefault(dbType);
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <DbTypeIcon dbType={resolved} variant={variant} />
      {showLabel && <span className={labelClassName}>{resolved}</span>}
    </span>
  );
};

export default DbTypeLabel;
