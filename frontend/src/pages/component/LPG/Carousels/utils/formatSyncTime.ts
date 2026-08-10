export function formatSyncTime(value?: string | null): string {
  if (!value?.trim()) return '—';
  const raw = value.trim();
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  return raw;
}
