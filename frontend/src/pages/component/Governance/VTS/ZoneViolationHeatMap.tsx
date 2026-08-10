import React, { useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface ZoneAlert {
  zone: string;
  alerts: number;
}

interface ViolationData {
  [key: string]: ZoneAlert[];
}

interface ZoneViolationHeatMapProps {
  data: ViolationData;
  alertType?: string;
  drillType?: 'zone' | 'plant';
}

const ZoneViolationHeatMap: React.FC<ZoneViolationHeatMapProps> = ({ 
  data, 
  alertType = 'all',
  drillType = 'zone'
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !data) return;

    const root = am5.Root.new(chartRef.current);
    if (root._logo) root._logo.dispose();

    root.setThemes([am5themes_Animated.new(root)]);
    
    const isPlantView = drillType === 'plant';
      
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: isPlantView,
        panY: false,
        wheelX: isPlantView ? 'panX' : 'none',
        wheelY: 'none',
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 60,
        paddingBottom: 10,
        layout: root.verticalLayout
      })
    );

    // Create Y axis (violation types)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      visible: true,
      minGridDistance: 20,
      inversed: false,
      minorGridEnabled: false
    });

    yRenderer.grid.template.set('visible', false);
    yRenderer.labels.template.setAll({
      fontSize: 9,
      fontWeight: '600',
      fill: am5.color('#374151'),
      oversizedBehavior: 'truncate',
      maxWidth: 150
    });

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        renderer: yRenderer,
        categoryField: 'violation'
      })
    );

    // Create X axis (zones) - at top
    const xRenderer = am5xy.AxisRendererX.new(root, {
      visible: true,
      minGridDistance: 30,
      minorGridEnabled: false,
      opposite: true
    });

    xRenderer.grid.template.set('visible', false);

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        renderer: xRenderer,
        categoryField: 'zone',
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    // Configure X-axis labels with tooltip
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 9,
      fontWeight: '600',
      fill: am5.color('#374151'),
      rotation: 0,
      centerX: am5.percent(50),
      centerY: am5.percent(50),
      oversizedBehavior: 'truncate',
      maxWidth: 50,
      ellipsis: '...',
      tooltipText: '{category}'
    });

    // Create series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        calculateAggregates: true,
        stroke: am5.color('#ffffff'),
        clustered: false,
        xAxis: xAxis,
        yAxis: yAxis,
        categoryXField: 'zone',
        categoryYField: 'violation',
        valueField: 'alerts'
      })
    );

    // Configure columns
    series.columns.template.setAll({
      tooltipText: '{violation} - {zone}: {alerts} alerts',
      strokeOpacity: 1,
      strokeWidth: 1,
      stroke: am5.color('#ffffff'),
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      cornerRadiusBL: 3,
      cornerRadiusBR: 3,
      width: am5.percent(100),
      height: am5.percent(100),
      templateField: "columnSettings"
    });

    const getHeatColor = (value: number, maxValueInRow: number) => {
      if (maxValueInRow === 0 || value === 0) return '#f3f4f6';
      
      const intensity = value / maxValueInRow;
      const shouldReverse = alertType === 'blocked' || alertType === 'auto_unblock';
      
      if (shouldReverse) {
        if (intensity >= 0.8) return '#1cc75b';
        if (intensity >= 0.6) return '#099c3f';
        if (intensity >= 0.4) return '#f59e0b';
        if (intensity >= 0.2) return '#ea580c';
        if (intensity > 0) return '#dc2626';
      } else {
        if (intensity >= 0.8) return '#dc2626';
        if (intensity >= 0.6) return '#ea580c';
        if (intensity >= 0.4) return '#f59e0b';
        if (intensity >= 0.2) return '#099c3f';
        if (intensity > 0) return '#1cc75b';
      }
      
      return '#f3f4f6';
    };

    
    const chartData: any[] = [];
    const violations = Object.keys(data);
    const allZones = new Set<string>();

    violations.forEach(violation => {
      data[violation].forEach(zoneData => {
        allZones.add(zoneData.zone);
      });
    });

    const zones = Array.from(allZones).sort();

    violations.forEach(violation => {
      const maxAlertsInRow = Math.max(...data[violation].map(z => z.alerts));
      
      zones.forEach(zone => {
        const zoneData = data[violation].find(z => z.zone === zone);
        const alerts = zoneData ? zoneData.alerts : 0;
        
        const color = getHeatColor(alerts, maxAlertsInRow);
        chartData.push({
          violation: violation,
          zone: zone,
          alerts: alerts,
          columnSettings: {
            fill: am5.color(color)
          }
        });
      });
    });

    series.bullets.push((root, series, dataItem) => {
      const ctx: any = dataItem.dataContext || {};
      const alerts = ctx.alerts ?? 0;

      return am5.Bullet.new(root, {
        sprite: am5.Label.new(root, {
          text: String(alerts),
          fill: alerts === 0 ? am5.color('#4b5563') : am5.color('#ffffff'),
          centerX: am5.percent(50),
          centerY: am5.percent(50),
          fontSize: 10,
          fontWeight: '600',
          shadowColor: am5.color('#000000'),
          shadowBlur: 2
        })
      });
    });

    series.data.setAll(chartData);
    yAxis.data.setAll(violations.map(v => ({ violation: v })));
    xAxis.data.setAll(zones.map(z => ({ zone: z })));

    // Enable horizontal scrollbar in plant view
    if (isPlantView) {
      chart.set("scrollbarX", am5.Scrollbar.new(root, {
        orientation: "horizontal"
      }));
      
      // Set initial zoom to show first few zones
      const totalZones = zones.length;
      const visibleZones = Math.min(14, totalZones); // Show first 8 zones
      
      xAxis.events.on("datavalidated", function() {
        xAxis.zoomToIndexes(0, visibleZones - 1);
      });
    }

    chart.appear(1000, 100);

    return () => root.dispose();
  }, [data, alertType, drillType]);

  const violations = Object.keys(data || {});
  const allZones = new Set<string>();
  
  violations.forEach(violation => {
    (data[violation] || []).forEach(zoneData => {
      allZones.add(zoneData.zone);
    });
  });

  const zoneCount = allZones.size;
  const isPlantView = drillType === 'plant';
  
  const calculatedHeight = isPlantView 
    ? Math.max(330, violations.length * 40) 
    : 280;
  
  const calculatedWidth = isPlantView
    ? Math.max(1200, zoneCount * 60) + 150 
    : '100%';

  return ( 
    <div 
      ref={containerRef}
      className="w-full"
    >
      <div
        ref={chartRef}
        style={{ 
          height: `${calculatedHeight}px`, 
          minHeight: `${calculatedHeight}px`,
          width: '100%'
        }}
      />
    </div>
  );
};

export default ZoneViolationHeatMap;
