import { useState, useEffect } from 'react';
// THE FIX: The imported type name is updated to match the change in index.ts.
import { ProcessedHourlyProductionData, GroupedShiftChartData, CarouselTotal } from '../Types';
import { HourlyProductionResponse } from '../Types/api';
import { apiService } from '../services/api';

const transformHourlyData = (apiResponse: HourlyProductionResponse | any): ProcessedHourlyProductionData => {
  if (!apiResponse || Object.keys(apiResponse).length === 0) {
    return { chartData: [], carouselKeys: [], carouselTotals: [] };
  }

  // New shape: { labels: string[], "1": number[], "2": number[], total1?: number, total2?: number }
  if (
    Array.isArray((apiResponse as any)?.labels) &&
    Array.isArray((apiResponse as any)?.["1"]) &&
    Array.isArray((apiResponse as any)?.["2"]) &&
    (apiResponse as any).labels.length === (apiResponse as any)["1"].length &&
    (apiResponse as any).labels.length === (apiResponse as any)["2"].length
  ) {
    const labels: string[] = (apiResponse as any).labels;
    const series1: number[] = (apiResponse as any)["1"]; // Carousel 1
    const series2: number[] = (apiResponse as any)["2"]; // Carousel 2

    const carouselKeys = ["Carousel 1", "Carousel 2"];
    const chartData = labels.map((label: string, idx: number) => ({
      timeSlot: label,
      [carouselKeys[0]]: Number(series1[idx] ?? 0),
      [carouselKeys[1]]: Number(series2[idx] ?? 0),
    })) as any;

    const total1 = typeof (apiResponse as any).total1 === 'number'
      ? Number((apiResponse as any).total1)
      : series1.reduce((sum, v) => sum + (Number(v) || 0), 0);
    const total2 = typeof (apiResponse as any).total2 === 'number'
      ? Number((apiResponse as any).total2)
      : series2.reduce((sum, v) => sum + (Number(v) || 0), 0);

    const carouselTotals = [
      { carouselName: carouselKeys[0], total: total1 },
      { carouselName: carouselKeys[1], total: total2 },
    ];

    return { chartData, carouselKeys, carouselTotals } as unknown as ProcessedHourlyProductionData;
  }

  const shiftMap: { [shiftName: string]: { [carouselName: string]: number } } = {
    Normal: {},
    Break: {},
    Overtime: {},
  };
  const carouselTotalsMap: { [carouselName: string]: number } = {};
  
  const sortedCarouselIds = Object.keys(apiResponse).sort((a, b) => Number(a) - Number(b));
  const carouselKeys = sortedCarouselIds.map(id => `Carousel ${id}`);

  carouselKeys.forEach(key => {
    carouselTotalsMap[key] = 0;
  });

  sortedCarouselIds.forEach(carouselId => {
    const carouselData = apiResponse[carouselId];
    const carouselName = `Carousel ${carouselId}`;
    
    const normalProd = carouselData.normal?.total_production || 0;
    const breakProd = carouselData.break?.total_production || 0;
    const overtimeProd = carouselData.overtime?.total_production || 0;

    shiftMap.Normal[carouselName] = normalProd;
    shiftMap.Break[carouselName] = breakProd;
    shiftMap.Overtime[carouselName] = overtimeProd;

    carouselTotalsMap[carouselName] = normalProd + breakProd + overtimeProd;
  });

  // THE FIX: The return type annotation is updated.
  const chartData: GroupedShiftChartData[] = (Object.keys(shiftMap) as Array<keyof typeof shiftMap>).map(shift => {
    const dataPoint: GroupedShiftChartData = { shift: shift as 'Normal' | 'Break' | 'Overtime' };
    carouselKeys.forEach(carouselName => {
      dataPoint[carouselName] = shiftMap[shift][carouselName] || 0;
    });
    return dataPoint;
  });

  const carouselTotals: CarouselTotal[] = carouselKeys.map(carouselName => ({
    carouselName,
    total: carouselTotalsMap[carouselName] || 0,
  }));

  return { chartData, carouselKeys, carouselTotals };
};

export const useHourlyProductionData = (
  sapId: number | undefined,
  refreshKey?: number
) => {
  const [data, setData] = useState<ProcessedHourlyProductionData>({ chartData: [], carouselKeys: [], carouselTotals: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sapId) {
      setData({ chartData: [], carouselKeys: [], carouselTotals: [] });
      return;
    }

    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiResponse = await apiService.getHourlyProduction(sapId, controller.signal);
        const processedData = transformHourlyData(apiResponse);
        
        if (!controller.signal.aborted) {
          setData(processedData);
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          setError(err.message || 'Failed to fetch hourly production data');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [sapId, refreshKey]);

  return { data, loading, error };
};
