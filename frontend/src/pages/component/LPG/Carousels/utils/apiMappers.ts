import type { ApiCarousel, ApiPlantLocation } from '../services/lpgCarouselsApi';
import type { CarouselConfig, DbType, PlantFormValues, PlantRecord } from '../types';
import { createDefaultShift } from '../types';
import { formatApiTime, parseApiTime, recalculateShift } from './formatHour';
import { normalizeDbTypeWithDefault } from './normalizeDbType';

const SHIFT_COLORS = [
  'bg-blue-500',
  'bg-orange-500',
  'bg-purple-500',
  'bg-teal-500',
  'bg-rose-500',
  'bg-indigo-500',
];

function toApiDbType(dbType: DbType): string {
  return dbType === 'MySQL' ? 'mysql' : 'postgres';
}

function fromApiDbType(dbType?: string): DbType {
  return normalizeDbTypeWithDefault(dbType);
}

export function mapPlantStatus(status?: boolean | string | number): 'Active' | 'Inactive' {
  if (typeof status === 'boolean') return status ? 'Active' : 'Inactive';
  if (typeof status === 'number') return status ? 'Active' : 'Inactive';
  if (typeof status === 'string') {
    const normalized = status.trim().toLowerCase();
    if (normalized === 'inactive' || normalized === 'false' || normalized === '0') {
      return 'Inactive';
    }
    if (normalized === 'active' || normalized === 'true' || normalized === '1') {
      return 'Active';
    }
  }
  return 'Active';
}

export function mapPlantFormToApiPayload(values: PlantFormValues) {
  const payload = {
    sap_id: Number(values.sapErpId),
    ip_address: values.ipAddress,
    port_no: Number(values.portNumber) || 0,
    username: values.username,
    db_name: values.dbName,
    db_type: toApiDbType(values.dbType),
    name: values.plantName,
    mail_recipients: values.mail_recipients,
  };

  return values.passwordEdited === false
    ? payload
    : {
        ...payload,
        password: values.password,
      };
}

function resolveCarouselCount(
  api: ApiPlantLocation,
  carousels: CarouselConfig[]
): number {
  if (typeof api.carousals === 'number') return api.carousals;
  if (Array.isArray(api.carousals)) return api.carousals.length;
  if (Array.isArray(api.carousels)) return api.carousels.length;
  return carousels.length;
}

function resolveEmbeddedCarousels(api: ApiPlantLocation): CarouselConfig[] {
  if (Array.isArray(api.carousals)) {
    return api.carousals.map(mapApiCarouselToConfig);
  }
  if (Array.isArray(api.carousels)) {
    return api.carousels.map(mapApiCarouselToConfig);
  }
  return [];
}

export function mapApiPlantToRecord(
  api: ApiPlantLocation,
  carousels: CarouselConfig[] = []
): PlantRecord {
  const resolvedCarousels = carousels.length > 0 ? carousels : resolveEmbeddedCarousels(api);
  const carouselCount = resolveCarouselCount(api, resolvedCarousels);

  return {
    id: String(api.sap_id),
    sapErpId: String(api.sap_id),
    plantName: api.plant_name || api.name || '',
    ipAddress: api.ip_address || '',
    portNumber: api.port != null ? String(api.port) : api.port_no != null ? String(api.port_no) : '',
    username: api.username || '',
    password: api.password || '',
    dbType: fromApiDbType(api.db_type),
    dbName: api.db_name || '',
    dbTypeIconUrl: fromApiDbType(api.db_type),
    status: mapPlantStatus(api.status),
    carouselCount,
    carousels: resolvedCarousels,
    lastProductionSyncTime: api.last_production_sync,
    lastEventSyncTime: api.last_event_sync,
    mail_recipients: api.mail_recipients || api.mail_recipients,
  };
}

export function mapApiCarouselToConfig(api: ApiCarousel): CarouselConfig {
  const shiftNames = new Set<string>();
  api.production_hrs?.forEach((slot) => {
    if (slot.shift_name) shiftNames.add(slot.shift_name);
  });

  const names = shiftNames.size > 0 ? Array.from(shiftNames) : ['Shift 1'];

  const shifts = names.map((shiftName, index) => {
    const production = api.production_hrs?.find((slot) => slot.shift_name === shiftName);
    const shiftBreaks = api.breaks?.filter((slot) => slot.shift_name === shiftName) ?? [];
    const fallback = createDefaultShift(shiftName, index);

    const startTime = production ? parseApiTime(production.start_time) : fallback.startTime;
    const endTime = production ? parseApiTime(production.stop_time) : fallback.endTime;

    const breaks =
      shiftBreaks.length > 0
        ? shiftBreaks.map((slot, breakIndex) => ({
            id: `break-${index}-${breakIndex}`,
            startTime: parseApiTime(slot.start_time),
            endTime: parseApiTime(slot.stop_time),
            description: slot.description ?? '',
          }))
        : [];

    return recalculateShift({
      ...fallback,
      id: `shift-${index + 1}`,
      label: shiftName,
      startTime: { ...startTime },
      endTime: { ...endTime },
      breaks,
      description: production?.description ?? '',
      color: SHIFT_COLORS[index % SHIFT_COLORS.length],
    });
  });

  const heads =
    typeof api.heads === 'number' && Number.isFinite(api.heads) && api.heads > 0
      ? api.heads
      : 24;

  return {
    id: api.carousal_id,
    name: api.name?.trim() || `Carousel ${api.carousal_id}`,
    status: api.status === 'Stopped' ? 'Stopped' : 'Running',
    heads,
    ratedProductivity: api.rated_productivity ?? 0,
    min_productivity: api.min_productivity ?? 0,
    max_productivity: api.max_productivity ?? 0,
    skip_zero_performance_score: api.skip_zero_performance_score ?? false,
    shifts,
  };
}

export function mapCarouselToApiPayload(sapId: number, carousel: CarouselConfig) {
  const production_hrs = carousel.shifts.map((shift) => ({
    shift_name: shift.label,
    start_time: formatApiTime(shift.startTime),
    stop_time: formatApiTime(shift.endTime),
    description: shift.description ?? '',
  }));

  // Use breaks from first shift (since all shifts share breaks)
  const firstShift = carousel.shifts[0];
  const breaks = firstShift
    ? firstShift.breaks.map((brk, index) => ({
        shift_name: `Break ${index + 1}`,
        start_time: formatApiTime(brk.startTime),
        stop_time: formatApiTime(brk.endTime),
        description: brk.description ?? '',
      }))
    : [];

  return {
    sap_id: sapId,
    carousal_id: carousel.id,
    heads: carousel.heads,
    rated_productivity: carousel.ratedProductivity,
    min_productivity: carousel.min_productivity,
    max_productivity: carousel.max_productivity,
    skip_zero_performance_score: carousel.skip_zero_performance_score,
    production_hrs,
    breaks,
  };
}
