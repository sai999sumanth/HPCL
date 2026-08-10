export type DbType = 'PostgreSQL' | 'MySQL';
export type AmPm = 'AM' | 'PM';

export interface Time12h {
  hour: number;
  minute: number;
  second: number;
  period: AmPm;
}

export interface BreakPeriod {
  id: string;
  startTime: Time12h;
  endTime: Time12h;
  description?: string;
}

export interface ShiftTiming {
  id: string;
  label: string;
  startTime: Time12h;
  endTime: Time12h;
  breaks: BreakPeriod[];
  breakHours: number;
  productionHours: number;
  color: string;
  description?: string;
}

export interface CarouselConfig {
  id: number;
  name: string;
  status: 'Running' | 'Stopped';
  heads: number;
  ratedProductivity: number;
  min_productivity?: number;
  max_productivity?: number;
  skip_zero_performance_score?: boolean;
  shifts: ShiftTiming[];
}

export interface PlantRecord {
  id: string;
  sapErpId: string;
  plantName: string;
  ipAddress: string;
  portNumber: string;
  username: string;
  password: string;
  dbType: DbType;
  dbTypeIconUrl: string;
  dbName: string;
  status: 'Active' | 'Inactive';
  connectionStatus?: string;
  connectionLatency?: string | number;
  connectionLoading?: boolean;
  carouselCount: number;
  carousels: CarouselConfig[];
  lastProductionSyncTime?: string;
  lastEventSyncTime?: string;
  mail_recipients?: string[];
}

export type PlantFormValues = Omit<PlantRecord, 'id' | 'status' | 'carousels' | 'carouselCount'> & {
  status?: PlantRecord['status'];
  passwordEdited?: boolean;
};

const SHIFT_COLORS = [
  'bg-blue-500',
  'bg-orange-500',
  'bg-purple-500',
  'bg-teal-500',
  'bg-rose-500',
  'bg-indigo-500',
];

export function createDefaultShift(shiftName: string, index: number): ShiftTiming {
  return {
    id: `shift-${Date.now()}-${index}`,
    label: shiftName,
    startTime: { hour: 9, minute: 0, second: 0, period: 'AM' },
    endTime: { hour: 5, minute: 30, second: 0, period: 'PM' },
    breaks: [],
    breakHours: 0,
    productionHours: 8.5,
    color: SHIFT_COLORS[index % SHIFT_COLORS.length],
    description: '',
  };
}

export function createTime12hDefaults(time: Partial<Time12h>): Time12h {
  return {
    hour: time.hour || 9,
    minute: time.minute || 0,
    second: time.second || 0,
    period: time.period || 'AM',
  };
}

export function getNextShiftName(shifts: ShiftTiming[]): string {
  const numbers = shifts
    .map((s) => {
      const match = s.label.match(/Shift\s+(\d+)/i);
      return match ? Number(match[1]) : 0;
    })
    .filter((n) => n > 0);
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : shifts.length + 1;
  return `Shift ${next}`;
}

export function getNextCarouselId(carousels: CarouselConfig[]): number {
  if (carousels.length === 0) return 1;
  return Math.max(...carousels.map((c) => c.id)) + 1;
}

export function createSingleCarousel(
  id: number,
  values?: Partial<Pick<CarouselConfig, 'name' | 'heads' | 'ratedProductivity' | 'status' | 'min_productivity' | 'max_productivity' | 'skip_zero_performance_score'>>
): CarouselConfig {
  return {
    id,
    name: values?.name?.trim() || `Carousel ${id}`,
    status: values?.status ?? 'Running',
    heads: values?.heads ?? 24,
    ratedProductivity: values?.ratedProductivity ?? 0,
    min_productivity: values?.min_productivity ?? 0,
    max_productivity: values?.max_productivity ?? 0,
    skip_zero_performance_score: values?.skip_zero_performance_score ?? false,
    shifts: [createDefaultShift('Shift 1', 0)],
  };
}

export type CarouselFormValues = Pick<CarouselConfig, 'name' | 'heads' | 'ratedProductivity' | 'min_productivity' | 'max_productivity' | 'skip_zero_performance_score'>;
