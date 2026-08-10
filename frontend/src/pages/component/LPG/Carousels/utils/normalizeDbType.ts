import type { DbType } from '../types';

/** Normalize API/UI values like "mysql", "postgres" to grid display types. */
export function normalizeDbType(raw?: string | null): DbType | undefined {
  if (raw == null || raw === '') return undefined;
  const lower = String(raw).trim().toLowerCase();
  if (lower.includes('mysql')) return 'MySQL';
  if (lower.includes('postgres')) return 'PostgreSQL';
  if (raw === 'MySQL' || raw === 'PostgreSQL') return raw;
  return undefined;
}

export function normalizeDbTypeWithDefault(raw?: string | null): DbType {
  return normalizeDbType(raw) ?? 'PostgreSQL';
}
