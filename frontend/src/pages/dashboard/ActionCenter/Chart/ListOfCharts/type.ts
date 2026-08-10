export type QueryFormColumn = PhysicalColumn | AdhocColumn;
export type PhysicalColumn = string;

export interface AdhocColumn {
    hasCustomLabel?: boolean;
    label?: string;
    optionName?: string;
    sqlExpression: string;
    expressionType: 'SQL';
    columnType?: 'BASE_AXIS' | 'SERIES';
    timeGrain?: string;
    datasourceWarning?: boolean;
  }

export type EchartsPieFormData = {
    // colorScheme?: string;
    // currentOwnValue?: string[] | null;
    // donut: boolean;
    // defaultValue?: string[] | null;
    groupby: QueryFormColumn[];
    // innerRadius: number;
    // labelLine: boolean;
    labelType: EchartsPieLabelType;
    // labelsOutside: boolean;
    // metric?: string;
    // outerRadius: number;
    // showLabels: boolean;
    // numberFormat: string;
    // dateFormat: string;
    // showLabelsThreshold: number;
  };

  export enum EchartsPieLabelType {
    Key = 'key',
    Value = 'value',
    Percent = 'percent',
    KeyValue = 'key_value',
    KeyPercent = 'key_percent',
    KeyValuePercent = 'key_value_percent',
  }

  export function isPhysicalColumn(column?: any): column is PhysicalColumn {
    return typeof column === 'string';
  }

  export const TimeGranularity = {
    DATE: 'date',
    SECOND: 'PT1S',
    MINUTE: 'PT1M',
    FIVE_MINUTES: 'PT5M',
    TEN_MINUTES: 'PT10M',
    FIFTEEN_MINUTES: 'PT15M',
    THIRTY_MINUTES: 'PT30M',
    HOUR: 'PT1H',
    DAY: 'P1D',
    WEEK: 'P1W',
    WEEK_STARTING_SUNDAY: '1969-12-28T00:00:00Z/P1W',
    WEEK_STARTING_MONDAY: '1969-12-29T00:00:00Z/P1W',
    WEEK_ENDING_SATURDAY: 'P1W/1970-01-03T00:00:00Z',
    WEEK_ENDING_SUNDAY: 'P1W/1970-01-04T00:00:00Z',
    MONTH: 'P1M',
    QUARTER: 'P3M',
    YEAR: 'P1Y',
  } as const;
  
  type ValueOf<T> = T[keyof T];
  
  export type TimeGranularity = ValueOf<typeof TimeGranularity>;