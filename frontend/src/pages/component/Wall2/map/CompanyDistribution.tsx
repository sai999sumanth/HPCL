import React, { useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { RefreshCw } from 'lucide-react';

interface CompanyData {
  category: string;
  value: number;
}

const CompanyDistribution: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);

  const data: CompanyData[] = [
    { category: 'IOCL', value: 215 },
    { category: 'HPCL', value: 190 },
    { category: 'BPCL', value: 141 },
    { category: 'HMEL', value: 1 }
  ];

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const COMPANY_COLORS: Record<string, string> = {
    'IOCL': '#EF4444', // Red
    'HPCL': '#3B82F6', // Blue
    'BPCL': '#F59E0B', // Yellow
    'HMEL': '#10B981' // Green
  };

  useEffect(() => {
    if (!chartRef.current) return;

    // Dispose existing chart
    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }

    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;

    if (root._logo) root._logo.dispose();

    root.setThemes([am5themes_Animated.new(root)]);

    // Create donut chart
    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.verticalLayout,
        innerRadius: am5.percent(65),
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 10,
        paddingBottom: 10
      })
    );

    // Create series
    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: 'value',
        categoryField: 'category',
        alignLabels: false,
        startAngle: -90,
        endAngle: 270
      })
    );

    // Set colors
    series.slices.template.setAll({
      fillOpacity: 1,
      stroke: am5.color('#FFFFFF'),
      strokeWidth: 2,
      templateField: 'sliceSettings'
    });

    // Disable labels and ticks
    series.labels.template.set('forceHidden', true);
    series.ticks.template.set('forceHidden', true);

    // Process data with colors
    const processedData = data.map(item => ({
      ...item,
      sliceSettings: {
        fill: am5.color(COMPANY_COLORS[item.category] || '#999999')
      }
    }));

    series.data.setAll(processedData);

    // Add center label
    const label = chart.seriesContainer.children.push(
      am5.Label.new(root, {
        text: `${total}\nTOTAL`,
        fontSize: 16,
        fontWeight: 'bold',
        centerX: am5.p50,
        centerY: am5.p50,
        textAlign: 'center',
        fill: am5.color('#1F2937')
      })
    );

    // Animate
    series.appear(1000, 100);

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <h3 className="text-base font-semibold text-gray-800">Company Distribution</h3>
        <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Chart */}
      <div className="flex items-center justify-center flex-1 min-h-0">
        <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '200px' }}></div>
      </div>
    </div>
  );
};

export default CompanyDistribution;
