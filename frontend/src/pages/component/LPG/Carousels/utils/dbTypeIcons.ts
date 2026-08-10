import postgresqlIcon from '@/assets/images/postgresql-icon.svg';
import mysqlIcon from '@/assets/images/mysql-icon.svg';
import type { DbType } from '../types';

export const DB_TYPE_ICONS: Record<DbType, string> = {
  PostgreSQL: postgresqlIcon,
  MySQL: mysqlIcon,
};
