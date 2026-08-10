import { apiClient } from '@/services/apiClient';
import type { CarouselConfig, PlantFormValues, PlantRecord } from '../types';
import {
  filenameFromContentDisposition,
  triggerBlobDownload,
} from '../utils/downloadBlob';
import {
  mapApiCarouselToConfig,
  mapApiPlantToRecord,
  mapCarouselToApiPayload,
  mapPlantFormToApiPayload,
} from '../utils/apiMappers';

const PLANTS_BASE = '/api/lpgplantsmaster';
const CAROUSELS_BASE = '/api/lpgcarousals';
const DEFAULT_PAGE = { skip: 0, limit: 100 };

export interface ApiTimeSlot {
  shift_name: string;
  start_time: string;
  stop_time: string;
  description?: string;
}

export interface ApiPlantLocation {
  id?: number;
  sap_id: number;
  ip_address?: string;
  port?: number;
  port_no?: number;
  username?: string;
  password?: string;
  db_name?: string;
  db_type?: string;
  name?: string;
  plant_name?: string;
  region?: string;
  zone?: string;
  entity_id?: number | null;
  status?: boolean | string;
  created_at?: string;
  updated_at?: string;
  carousals?: number | ApiCarousel[];
  carousels?: number | ApiCarousel[];
  last_event_sync?: string;
  last_production_sync?: string;
  mail_recipients?: string[];
}

export interface ApiCarousel {
  sap_id: number;
  carousal_id: number;
  heads?: number;
  rated_productivity?: number;
  min_productivity?: number;
  max_productivity?: number;
  skip_zero_performance_score?: boolean;
  production_hrs?: ApiTimeSlot[];
  breaks?: ApiTimeSlot[];
  name?: string;
  status?: string;
  filters?: unknown;
}

export interface PlantDetailsApiResponse {
  status?: boolean;
  message?: string;
  data?: ApiPlantLocation[];
}

function extractPlantDetails(payload: unknown): ApiPlantLocation | null {
  const root = payload as PlantDetailsApiResponse;
  if (Array.isArray(root?.data) && root.data.length > 0) {
    return root.data[0];
  }
  const list = extractArray<ApiPlantLocation>(payload);
  return list[0] ?? null;
}

function extractArray<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const root = payload as Record<string, unknown>;
  if (Array.isArray(root.data)) return root.data as T[];
  if (root.data && typeof root.data === 'object') {
    const nested = root.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data as T[];
    if (Array.isArray(nested.carousals)) return nested.carousals as T[];
    if (Array.isArray(nested.carousals)) return nested.carousals as T[];
  }
  if (Array.isArray(root.carousals)) return root.carousals as T[];
  if (Array.isArray(root.carousals)) return root.carousals as T[];

  return [];
}

function extractObject<T>(payload: unknown): T | null {
  if (!payload) return null;
  if (Array.isArray(payload)) return (payload[0] as T) ?? null;

  const root = payload as Record<string, unknown>;
  if (root.data && typeof root.data === 'object' && !Array.isArray(root.data)) {
    return root.data as T;
  }
  return root as T;
}

async function fetchPlantDetailsRaw(sapId: number): Promise<ApiPlantLocation | null> {
  const response = await apiClient.post<PlantDetailsApiResponse>(
    `${PLANTS_BASE}/plant_details`,
    { sap_id: sapId }
  );
  return extractPlantDetails(response.data);
}

async function fetchAllPlantDetailsRaw(): Promise<ApiPlantLocation[]> {
  const response = await apiClient.post<PlantDetailsApiResponse>(
    `${PLANTS_BASE}/plant_details`,
    { sap_id: 0 }
  );
  return extractArray<ApiPlantLocation>(response.data);
}

export interface ConnectionStatusResult {
  status: string;
  latency: string | number;
  plantName?: string;
}

export interface ApiActionResponse {
  status?: boolean;
  message?: string;
  data?: unknown;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as {
      response?: { data?: { message?: string; detail?: string } };
      message?: string;
    };
    return err.response?.data?.message || err.response?.data?.detail || err.message || fallback;
  }
  return fallback;
}

function assertApiSuccess(payload: unknown, fallback: string): void {
  if (!payload || typeof payload !== 'object') return;
  const root = payload as ApiActionResponse;
  if (root.status === false) {
    throw new Error(root.message || fallback);
  }
}

function groupCarouselsBySapId(carousels: ApiCarousel[]): Map<number, CarouselConfig[]> {
  const grouped = new Map<number, CarouselConfig[]>();
  carousels.forEach((carousel) => {
    const sapId = Number(carousel.sap_id);
    const list = grouped.get(sapId) ?? [];
    list.push(mapApiCarouselToConfig(carousel));
    grouped.set(sapId, list);
  });
  return grouped;
}

export const lpgCarouselsApi = {
  async testPlantConnection(values: PlantFormValues): Promise<boolean> {
    const response = await apiClient.post<ApiActionResponse>(
      `${PLANTS_BASE}/test_connection`,
      mapPlantFormToApiPayload(values)
    );
    assertApiSuccess(response.data, 'Connection test failed.');
    return response.data?.status !== false;
  },

  async checkConnectionStatus(sapId: number): Promise<ConnectionStatusResult> {
    const response = await apiClient.post('/api/lpgplantoperations/check_connection_status', {
      sap_id: String(sapId),
    });
    const payload = (response.data as { data?: Record<string, unknown> })?.data ?? response.data ?? {};
    const record =
      Array.isArray((payload as { connection_status?: unknown[] }).connection_status) &&
      (payload as { connection_status: unknown[] }).connection_status.length > 0
        ? ((payload as { connection_status: Record<string, unknown>[] }).connection_status[0] as Record<
            string,
            unknown
          >)
        : {};
    return {
      status: String(record.status ?? '').toUpperCase(),
      latency: (record.latency as string | number | undefined) ?? '-',
      plantName: typeof record.plant_name === 'string' ? record.plant_name : undefined,
    };
  },

  async getCarouselsForPlant(sapId: number): Promise<CarouselConfig[]> {
    const carousels = await this.getAllCarousels();
    return carousels
      .filter((carousel) => Number(carousel.sap_id) === sapId)
      .map(mapApiCarouselToConfig);
  },

  async getAllPlants(): Promise<PlantRecord[]> {
    const plants = await fetchAllPlantDetailsRaw();
    return plants.map((plant) => mapApiPlantToRecord(plant));
  },

  /** Loads carousel configs per plant without blocking the plants table render. */
  async attachCarouselsToPlants(plants: PlantRecord[]): Promise<PlantRecord[]> {
    const allCarousels = await this.getAllCarousels(0, 1000);
    const carouselsBySapId = groupCarouselsBySapId(allCarousels);

    return plants.map((plant) => {
      const plantCarousels = carouselsBySapId.get(Number(plant.sapErpId)) ?? [];
      return {
        ...plant,
        carousels: plantCarousels,
        carouselCount: plantCarousels.length,
      };
    });
  },

  async getPlantById(sapId: number): Promise<PlantRecord | null> {
    const response = await apiClient.get(`${PLANTS_BASE}/${sapId}`);
    const plant = extractObject<ApiPlantLocation>(response.data);
    if (!plant) return null;

    const carouselResponse = await apiClient.get(CAROUSELS_BASE, { params: DEFAULT_PAGE });
    const carousels = extractArray<ApiCarousel>(carouselResponse.data)
      .filter((c) => Number(c.sap_id) === sapId)
      .map(mapApiCarouselToConfig);

    return mapApiPlantToRecord(plant, carousels);
  },

  async getPlantDetails(sapId: number): Promise<PlantRecord | null> {
    const plant = await fetchPlantDetailsRaw(sapId);
    if (!plant) return null;

    const carouselResponse = await apiClient.get(CAROUSELS_BASE, { params: DEFAULT_PAGE });
    const carousels = extractArray<ApiCarousel>(carouselResponse.data)
      .filter((c) => Number(c.sap_id) === sapId)
      .map(mapApiCarouselToConfig);

    return mapApiPlantToRecord(plant, carousels);
  },

  async createPlant(values: PlantFormValues): Promise<void> {
    const response = await apiClient.post<ApiActionResponse>(
      `${PLANTS_BASE}/create_location`,
      mapPlantFormToApiPayload(values)
    );
    assertApiSuccess(response.data, 'Failed to create plant.');
  },

  async updatePlant(values: PlantFormValues): Promise<void> {
    const response = await apiClient.post<ApiActionResponse>(
      `${PLANTS_BASE}/update_location`,
      mapPlantFormToApiPayload(values)
    );
    assertApiSuccess(response.data, 'Failed to update plant.');
  },

  async deletePlant(sapId: number): Promise<void> {
    const response = await apiClient.post<ApiActionResponse>(`${PLANTS_BASE}/delete_location`, {
      sap_id: sapId,
    });
    assertApiSuccess(response.data, 'Failed to delete plant.');
  },

  async getAllCarousels(skip = DEFAULT_PAGE.skip, limit = DEFAULT_PAGE.limit): Promise<ApiCarousel[]> {
    const response = await apiClient.get(CAROUSELS_BASE, { params: { skip, limit } });
    return extractArray<ApiCarousel>(response.data);
  },

  async getCarouselById(carousalId: number): Promise<CarouselConfig | null> {
    const response = await apiClient.get(`${CAROUSELS_BASE}/${carousalId}`);
    const carousel = extractObject<ApiCarousel>(response.data);
    return carousel ? mapApiCarouselToConfig(carousel) : null;
  },

  async createCarousel(sapId: number, carousel: CarouselConfig): Promise<void> {
    await apiClient.post(
      `${CAROUSELS_BASE}/create_carousal`,
      mapCarouselToApiPayload(sapId, carousel)
    );
  },

  async updateCarousel(sapId: number, carousel: CarouselConfig): Promise<void> {
    await apiClient.post(
      `${CAROUSELS_BASE}/update_carousal`,
      mapCarouselToApiPayload(sapId, carousel)
    );
  },

  async deleteCarousel(sapId: number, carousalId: number): Promise<void> {
    await apiClient.post(`${CAROUSELS_BASE}/delete_carousal`, {
      sap_id: sapId,
      carousal_id: carousalId,
    });
  },

  async downloadMasterData(): Promise<void> {
    const response = await apiClient.post(
      `${PLANTS_BASE}/download_plant_and_carousal_details`,
      {},
      { responseType: 'blob' }
    );
    const filename = filenameFromContentDisposition(
      response.headers['content-disposition'] as string | undefined,
      'lpg_master_data.xlsx'
    );
    triggerBlobDownload(response.data as Blob, filename);
  },
};
