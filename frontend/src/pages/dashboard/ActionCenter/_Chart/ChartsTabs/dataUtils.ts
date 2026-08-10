import moment from "moment";

export type SelectOptionType = {
  value: string;
  label: string;
};

export type CustomRangeDecodeType = {
  customRange: CustomRangeType;
  matchedFlag: boolean;
};

export const SEPARATOR = ' : ';
export const buildTimeRangeString = (since: string, until: string): string =>
  `${since}${SEPARATOR}${until}`;

const formatDateEndpoint = (dttm: string, isStart?: boolean): string =>
  dttm.replace('T00:00:00', '') || (isStart ? '-∞' : '∞');

export const formatTimeRange = (
  timeRange: string,
  columnPlaceholder = 'col',
) => {
  const splitDateRange = timeRange.split(SEPARATOR);
  if (splitDateRange.length === 1) return timeRange;
  return `${formatDateEndpoint(
    splitDateRange[0],
    true,
  )} ≤ ${columnPlaceholder} < ${formatDateEndpoint(splitDateRange[1])}`;
};


export type CommonRangeType =
  | 'Last day'
  | 'Last week'
  | 'Last month'
  | 'Last quarter'
  | 'Last year';

export const PreviousCalendarWeek = 'previous calendar week';
export const PreviousCalendarMonth = 'previous calendar month';
export const PreviousCalendarYear = 'previous calendar year';

export const CALENDAR_RANGE_OPTIONS: SelectOptionType[] = [
  { value: PreviousCalendarWeek, label: 'previous calendar week' },
  { value: PreviousCalendarMonth, label: 'previous calendar month' },
  { value: PreviousCalendarYear, label: 'previous calendar year' },
];

export const COMMON_RANGE_SET: Set<CommonRangeType> = new Set([
  'Last day',
  'Last week',
  'Last month',
  'Last quarter',
  'Last year',
]);

export const FRAME_OPTIONS: SelectOptionType[] = [
  { value: 'Common', label: 'Last' },
  { value: 'Calendar', label: 'Previous' },
  { value: 'Custom', label: 'Custom' },
  { value: 'Advanced', label: 'Advanced' },
  { value: 'No filter', label: 'No filter' },
];

export const COMMON_RANGE_OPTIONS: SelectOptionType[] = [
  { value: 'Last day', label: 'last day' },
  { value: 'Last week', label: 'last week' },
  { value: 'Last month', label: 'last month' },
  { value: 'Last quarter', label: 'last quarter' },
  { value: 'Last year', label: 'last year' },
];

export const SINCE_MODE_OPTIONS: SelectOptionType[] = [
  { value: 'specific', label: 'Specific Date/Time' },
  { value: 'relative', label: 'Relative Date/Time' },
  { value: 'now', label: 'Now' },
  { value: 'today', label: 'Midnight' },
];

const GRAIN_OPTIONS = [
  { value: 'second', label: (rel) => `Seconds ${rel}` },
  { value: 'minute', label: (rel) => `Minutes ${rel}` },
  { value: 'hour', label: (rel) => `Hours ${rel}` },
  { value: 'day', label: (rel) => `Days ${rel}` },
  { value: 'week', label: (rel) => `Weeks ${rel}` },
  { value: 'month', label: (rel) => `Months ${rel}` },
  { value: 'quarter', label: (rel) => `Quarters ${rel}` },
  { value: 'year', label: (rel) => `Years ${rel}` },
];

export const SINCE_GRAIN_OPTIONS: SelectOptionType[] = GRAIN_OPTIONS.map(
  item => ({
    value: item.value,
    label: item.label('Before'),
  }),
);

export const UNTIL_GRAIN_OPTIONS: SelectOptionType[] = GRAIN_OPTIONS.map(
  item => ({
    value: item.value,
    label: item.label('After'),
  }),
);

export const UNTIL_MODE_OPTIONS: SelectOptionType[] =
  SINCE_MODE_OPTIONS.slice();

export type DateTimeGrainType =
| 'second'
| 'minute'
| 'hour'
| 'day'
| 'week'
| 'month'
| 'quarter'
| 'year';

export type CustomRangeKey =
  | 'sinceMode'
  | 'sinceDatetime'
  | 'sinceGrain'
  | 'sinceGrainValue'
  | 'untilMode'
  | 'untilDatetime'
  | 'untilGrain'
  | 'untilGrainValue'
  | 'anchorMode'
  | 'anchorValue';

export type DateTimeModeType = 'specific' | 'relative' | 'now' | 'today';
export type CustomRangeType = {
  sinceMode: DateTimeModeType;
  sinceDatetime: string;
  sinceGrain: DateTimeGrainType;
  sinceGrainValue: number;
  untilMode: DateTimeModeType;
  untilDatetime: string;
  untilGrain: DateTimeGrainType;
  untilGrainValue: number;
  anchorMode: 'now' | 'specific';
  anchorValue: string;
};

export const MOMENT_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss';
export const MIDNIGHT = moment().utc().startOf('day').format(MOMENT_FORMAT);

export const SEVEN_DAYS_AGO = moment()
  .utc()
  .startOf('day')
  .subtract(7, 'days')
  .format(MOMENT_FORMAT);

export type FrameComponentProps = {
  onChange?: (timeRange: string) => void;
  applyChanges: (timeRange: string) => void;
  onAdvancedTimeChange?: (timeRange: string) => void;
  value: string;
};

export interface DateFilterControlProps {
  name: string;
  onChange: (timeRange: string) => void;
  value?: string;
}