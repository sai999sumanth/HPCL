import { Stage, StageMap } from './types';

export const getStagesWithCount = (stages: Stage[]): StageMap => {
  return stages.reduce((acc, stage, index) => {
    const key = stage.present_stage;
    if (!acc[key]) {
      acc[key] = { count: 1, indices: [index] };
    } else {
      acc[key].count++;
      acc[key].indices.push(index);
    }
    return acc;
  }, {} as StageMap);
};

export const calculateDotPosition = (stage: number, totalStages: number): string => {
  const stepSize = 100 / (totalStages - 1);
  const position = (stage - 0.5) * stepSize;
  return `${position}%`;
};

export const getMaxStage = (stages: Stage[]): number => {
  return Math.max(...stages.map(stage => stage.present_stage));
};

export const transformChartData = (rawData: any[]): Record<string, Stage[]> => {
    return rawData.reduce((acc, item) => {
      const [sapId, stages] = Object.entries(item)[0];
      acc[sapId] = stages;
      return acc;
    }, {} as Record<string, Stage[]>);
  };