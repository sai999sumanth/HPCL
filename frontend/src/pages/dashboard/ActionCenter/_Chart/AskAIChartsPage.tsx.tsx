import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import AskAITab from './ChartsTabs/AskAITab';
import ChartPreview from './ChartsPreview/ChartsPreview';

interface AskAIChartsPageProps {
  dataset: string;
  chartType: string;
}

const AskAIChartsPage: React.FC<AskAIChartsPageProps> = ({ dataset, chartType }) => {
  const [chartData, setChartData] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState('Westeros');
  const [clearChartPreview, setClearChartPreview] = useState(false);

  const handleChartCreated = (chartOptions: any) => {
    setChartData(chartOptions);
  };

  const handleThemeChange = (theme: string) => {
    setSelectedTheme(theme);
  };

  const handleClearChartPreview = () => {
    setClearChartPreview(true);
    setChartData(null);
  };

  useEffect(() => {
    if (clearChartPreview) {
      setClearChartPreview(false);
    }
  }, [clearChartPreview]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-[100vh]">
        {/* AskAITab positioned at the top */}
        <div className="bg-white py-0">
          <AskAITab
            dataset={dataset}
            chartData={chartData}
            chartType={chartType}
            selectedTheme={selectedTheme}
            setChartData={setChartData}
            onThemeChange={handleThemeChange}
            onChartCreated={handleChartCreated}
          />
        </div>

        {/* ChartPreview taking up the remaining space */}
        <div className="flex-1 overflow-hidden">
          <ChartPreview
            dataset={dataset}
            chartData={chartData}
            chartType={chartType}
            selectedTheme={selectedTheme}
            setChartData={setChartData}
            onThemeChange={handleThemeChange}
          />
        </div>
      </div>
    </DndProvider>
  );
};

export default AskAIChartsPage;