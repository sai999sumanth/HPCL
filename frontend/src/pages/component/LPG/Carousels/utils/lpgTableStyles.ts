/** Shared typography and layout classes for LPG Carousels data tables. */
export const LPG_TABLE = {
  table: 'w-full border-collapse',
  headerRow: 'border-b border-gray-200 bg-gray-100 text-left text-gray-700',
  headerCell: 'whitespace-nowrap px-3 py-2 text-xs font-semibold text-gray-700',
  headerCellCenter: 'whitespace-nowrap px-3 py-2 text-center text-xs font-semibold text-gray-700',
  bodyRow: 'border-b border-gray-200 bg-white transition-colors last:border-b-0 hover:bg-gray-50',
  bodyCell: 'whitespace-nowrap px-3 py-2 align-middle text-[12px] text-gray-700',
  bodyCellEmphasis: 'whitespace-nowrap px-3 py-2 align-middle text-[11px] font-medium text-gray-900',
  bodyCellMono:
    'whitespace-nowrap px-3 py-2 align-middle font-mono text-[11px] font-medium text-gray-900',
  badge:
    'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold',
  emptyCell: 'px-3 py-10 text-center text-sm text-gray-500',
  searchInput: 'h-8 pl-8 text-sm',
  footer: 'flex shrink-0 flex-col gap-2 border-t border-gray-200 bg-gray-50 px-3 py-1 sm:flex-row sm:items-center sm:justify-between',
  footerText: 'text-xs text-gray-600',
} as const;

export const DEFAULT_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
