import { useLayoutEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5stock from '@amcharts/amcharts5/stock';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface StockData {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const StockChartComponent: React.FC = () => {
  const chartId = useRef(`chart-${Math.random().toString(36).substr(2, 9)}`);
  const controlsId = useRef(`controls-${Math.random().toString(36).substr(2, 9)}`);
  const rootRef = useRef<am5.Root | null>(null);

  useLayoutEffect(() => {
    if (rootRef.current) {
      rootRef.current.dispose();
    }

    const root = am5.Root.new(chartId.current);
    rootRef.current = root;

    // Generate dummy data
    const generateDummyData = (): StockData[] => {
      const data: StockData[] = [];
      const today = new Date();
      let basePrice = 100;

      for (let i = 30; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        const volatility = 2;
        const change = (Math.random() - 0.5) * volatility;
        basePrice *= (1 + change / 100);
        
        data.push({
          date: date.getTime(),
          open: basePrice * (1 + (Math.random() - 0.5) * 0.01),
          high: basePrice * (1 + Math.random() * 0.02),
          low: basePrice * (1 - Math.random() * 0.02),
          close: basePrice,
          volume: Math.round(Math.random() * 1000000 + 500000)
        });
      }
      return data;
    };

    // Set themes
    root.setThemes([am5themes_Animated.new(root)]);

    // Create stock chart
    const stockChart = root.container.children.push(
      am5stock.StockChart.new(root, {})
    );

    // Create main panel
    const mainPanel = stockChart.panels.push(
      am5stock.StockPanel.new(root, {
        wheelY: "zoomX",
        panX: true,
        panY: true,
        height: am5.percent(70)
      })
    );

    // Create value axis
    const valueAxis = mainPanel.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {
          pan: "zoom"
        })
      })
    );

    // Create date axis
    const dateAxis = mainPanel.xAxes.push(
      am5xy.GaplessDateAxis.new(root, {
        baseInterval: { timeUnit: "day", count: 1 },
        renderer: am5xy.AxisRendererX.new(root, {})
      })
    );

    // Create candlestick series
    const valueSeries = mainPanel.series.push(
      am5xy.CandlestickSeries.new(root, {
        name: "TSLA",
        valueYField: "close",
        openValueYField: "open",
        lowValueYField: "low",
        highValueYField: "high",
        valueXField: "date",
        tooltipText: "{name}\nOpen: {openValueY}\nLow: {lowValueY}\nHigh: {highValueY}\nClose: {valueY}",
        xAxis: dateAxis,
        yAxis: valueAxis
      })
    );

    // Create volume panel
    const volumePanel = stockChart.panels.push(
      am5stock.StockPanel.new(root, {
        wheelY: "zoomX",
        panX: true,
        panY: true,
        height: am5.percent(30)
      })
    );

    // Create volume axes
    const volumeValueAxis = volumePanel.yAxes.push(
      am5xy.ValueAxis.new(root, {
        numberFormat: "#.#a",
        renderer: am5xy.AxisRendererY.new(root, {})
      })
    );

    const volumeDateAxis = volumePanel.xAxes.push(
      am5xy.GaplessDateAxis.new(root, {
        baseInterval: { timeUnit: "day", count: 1 },
        renderer: am5xy.AxisRendererX.new(root, {})
      })
    );

    // Add volume series
    const volumeSeries = volumePanel.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Volume",
        valueYField: "volume",
        valueXField: "date",
        xAxis: volumeDateAxis,
        yAxis: volumeValueAxis,
        tooltipText: "{valueY}"
      })
    );

    // Add toolbar
    const toolbar = am5stock.StockToolbar.new(root, {
      container: document.getElementById(controlsId.current),
      stockChart: stockChart,
      controls: [
        am5stock.PeriodSelector.new(root, {
          stockChart: stockChart
        }),
        am5stock.DrawingControl.new(root, {
          stockChart: stockChart
        }),
        am5stock.ResetControl.new(root, {
          stockChart: stockChart
        })
      ]
    });

    // Set data
    const data = generateDummyData();
    valueSeries.data.setAll(data);
    volumeSeries.data.setAll(data);

    // Clean up
    return () => {
      root.dispose();
    };
  }, []);

  return (
    <div>
      <div id={controlsId.current} style={{ height: "60px" }} />
      <div id={chartId.current} style={{ width: "100%", height: "800px", background:"balck",color:"white" }} />
    </div>
  );
};

export default StockChartComponent;