import { TrackerItem } from "@/types/tracker";


export const getMaxStage = (entries: TrackerItem[]): number => {
  return Math.max(...entries.map(entry => entry.present_stage));
};

export const groupEntriesByStage = (entries: TrackerItem[]): Record<number, TrackerItem[]> => {
  return entries.reduce((acc, entry) => {
    const stage = entry.present_stage;
    if (!acc[stage]) {
      acc[stage] = [];
    }
    acc[stage].push(entry);
    return acc;
  }, {} as Record<number, TrackerItem[]>);
};

export const calculateLineWidth = (maxStage: number): string => {
  const lineWidth = (maxStage - 1) * 100;

  if (lineWidth > 290 && lineWidth < 300) {
    return `${lineWidth - 10}%`;
  } else if (lineWidth >= 300 && lineWidth < 350) {
    return `${lineWidth - 25}%`;
  } else if (lineWidth >= 350 && lineWidth < 395) {
    return `${lineWidth - 40}%`;
  } else if (lineWidth > 560 && lineWidth < 590) {
    return `${lineWidth - 30}%`;
  } else if (lineWidth > 650 && lineWidth < 700) {
    return `${lineWidth - 50}%`;
  } else {
    return `${lineWidth - maxStage}%`;
  }
};
