
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/@/components/ui/alert';
import { SBUlevelAgGrid } from '../SBUlevelAgGrid';
import { apiClient } from '@/services/apiClient';

interface SBUData {
  sbu_name: string;
  [key: string]: string | number;
}

interface IndustryHeatmapProps {
  initialData: SBUData[];
  companies: string[];
}

const calculateHistoryTotal = (data: SBUData) => {
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
  let total = 0;
  let validValues = 0;

  months.forEach(month => {
    const actual = Number(data[`${month}_actual`]);
    const history = Number(data[`${month}_history`]);
    if (history !== 0) {
      const variance = ((actual - history) / history) * 100;
      if (!isNaN(variance)) {
        total += variance;
        validValues++;
      }
    }
  });

  return validValues > 0 ? total / validValues : null;
};

const IndustryHeatmap: React.FC<IndustryHeatmapProps> = ({ initialData }) => {
  const [selectedCompany, setSelectedCompany] = useState("HPCL");
  const [data, setData] = useState(initialData);
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const companies = [
    "BPCL", "HPCL", "IOCL", "ONGC", "RIL", "SMA", "CPCL", 
    "GAIL", "HMEL", "MRPL", "NEL", "NRL", "SHELL", "OIL"
  ];

  const fetchHeatmapData = async (company: string) => {
    try {
      setIsLoading(true);
      const requestBody = {
        filters: [
          {
            key: "\"A\"",
            cond: "equals",
            value: "true"
          },
          {
            key: "\"H\"",
            cond: "equals",
            value: "true"
          },
          {
            key: "\"company_name\"",
            cond: "equals",
            value: company.toLowerCase()
          }
        ],
        cross_filters: [],
        action: "industry_performance",
        drill_state: "",
        time_grain: "Monthly",
        resp_format: "company_level_heatmap",
        resp_level: "sbu_level"
      };

      const response = await apiClient.post('/api/charts/generate_vis_data', requestBody)

      if (!response.status) throw new Error("Network response was not ok")
      const newData = await response.data
      setData(newData.data);
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyChange = (value: string) => {
    setSelectedCompany(value);
    fetchHeatmapData(value);
  };

  useEffect(() => {
    if (!data) {
      fetchHeatmapData('HPCL');
    }
  }, []);

  useEffect(() => {
    const loadChart = async () => {
      const am5 = await import("@amcharts/amcharts5/index");
      const am5xy = await import("@amcharts/amcharts5/xy");
      const am5themes_Animated = await import("@amcharts/amcharts5/themes/Animated");

      if (rootRef.current) {
        rootRef.current.dispose();
      }

      const root = am5.Root.new(chartRef.current!);
      rootRef.current = root;

      root.setThemes([am5themes_Animated.default.new(root)]);

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: false,
          panY: false,
          wheelX: "none",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingBottom: 0,
          paddingTop: 0,
          paddingLeft: 0,
          paddingRight: 0
        })
      );

      root._logo?.dispose();

      const yRenderer = am5xy.AxisRendererY.new(root, {
        minGridDistance: 15,
        inversed: true,
      });

      yRenderer.labels.template.setAll({
        fontSize: 10,
        paddingRight: 2,
        fontWeight: "bold"
      });

      const xRenderer = am5xy.AxisRendererX.new(root, {
        minGridDistance: 20,
        opposite:true
      });

      xRenderer.labels.template.setAll({
        fontSize: 11,
        paddingTop: 2,
        fontWeight: "bold"
      });

      const yAxis = chart.yAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "category",
          renderer: yRenderer,
          tooltip: am5.Tooltip.new(root, {})
        })
      );

      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: "category",
          renderer: xRenderer,
          tooltip: am5.Tooltip.new(root, {})
        })
      );


      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          calculateAggregates: true,
          stroke: am5.color(0xffffff),
          clustered: false,
          xAxis: xAxis,
          yAxis: yAxis,
          categoryXField: "monthCategory",
          categoryYField: "sbuCategory",
          valueField: "value"
        })
      );

      series.columns.template.setAll({
        tooltipText: "{sbuCategory}, {monthCategory}: {value}%",
        strokeOpacity: 1,
        strokeWidth: 0.5,
        width: am5.percent(100),
        height: am5.percent(100),
        templateField: "columnSettings"
      });

      series.bullets.push(function(root) {
        return am5.Bullet.new(root, {
          locationX: 0.5,
          locationY: 0.5,
          sprite: am5.Label.new(root, {
            text: "{value}%",
            populateText: true,
            centerX: am5.p50,
            centerY: am5.p50,
            textAlign: "center",
            fontSize: 10,
            fontWeight: "600",
            fill: am5.color(0x000000),
            templateField: "labelSettings"
          })
        });
      });

      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
      const processedData: any[] = [];
      const sbuCategories: string[] = [];

      data.filter(sbu => sbu.sbu_name !== 'Unknown').forEach(sbu => {
        sbuCategories.push(sbu.sbu_name);

        // Add monthly data first
        months.forEach(month => {
          const actual = Number(sbu[`${month}_actual`]) || 0;
          const history = Number(sbu[`${month}_history`]) || 0;
          const variance = history !== 0 ? ((actual - history) / history * 100) : 0;
          
          let color;
          if (variance === 0) {
            color = am5.color(0xB0B0B0); // Gray color for 0
          } else if (variance < 0) {
            color = am5.color(0xFFD5CF); // Light red for negative values
          } else {
            color = am5.color(0x9EFFC8); // Light green for positive values
          }

          const textColor = am5.color(0x000000);

          processedData.push({
            monthCategory: month,
            sbuCategory: sbu.sbu_name,
            value: parseFloat(variance.toFixed(2)) || 0, // Use 0 if NaN
            columnSettings: {
              fill: color
            },
            labelSettings: {
              fill: textColor
            }
          });
        });

        // Add total column at the end
        const totalVariance = calculateHistoryTotal(sbu);
        const variance = totalVariance || 0; // Use 0 if null/undefined
        
        let color;
        if (variance === 0) {
          color = am5.color(0xB0B0B0); // Gray color for 0
        } else if (variance < 0) {
          color = am5.color(0xFFD5CF); // Light red for negative values
        } else {
          color = am5.color(0x9EFFC8); // Light green for positive values
        }

        const textColor = am5.color(0x000000) 

        processedData.push({
          monthCategory: 'Total',
          sbuCategory: sbu.sbu_name,
          value: parseFloat(variance.toFixed(2)) || 0, // Use 0 if NaN
          columnSettings: {
            fill: color
          },
          labelSettings: {
            fill: textColor
          }
        });
      });

      series.data.setAll(processedData);
      yAxis.data.setAll(sbuCategories.map(sbu => ({ category: sbu })));
      xAxis.data.setAll(['Total',...months].map(month => ({ category: month }))); // Add Total at the end

      // Configure series columns
      series.columns.template.setAll({
        tooltipText: "{sbuCategory}, {monthCategory}: {value}%",
        strokeOpacity: 1,
        strokeWidth: 0.5,
        width: am5.percent(100),
        height: am5.percent(100),
        templateField: "columnSettings"
      });

      // Configure value labels
      series.bullets.push(function(root) {
        return am5.Bullet.new(root, {
          locationX: 0.5,
          locationY: 0.5,
          sprite: am5.Label.new(root, {
            text: "{value}%",
            populateText: true,
            centerX: am5.p50,
            centerY: am5.p50,
            textAlign: "center",
            fontSize: 10,
            fontWeight: "500",
            templateField: "labelSettings"
          })
        });
      });

      chart.appear(1000);
    };

    if (data && data.length > 0) {
      loadChart();
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
      }
    };
  }, [data]);
  const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState<Error | null>(null);
  
    useEffect(() => {
      const handleError = (error: ErrorEvent) => {
        setHasError(true);
        setError(error.error);
      };
  
      window.addEventListener('error', handleError);
      return () => window.removeEventListener('error', handleError);
    }, []);
  
    if (hasError) {
      return (
        <Alert variant="destructive">
          <AlertDescription>
            An error occurred while loading the data. Please try refreshing the page.
            {error && <div className="mt-2 text-xs">{error.message}</div>}
          </AlertDescription>
        </Alert>
      );
    }
  
    return <>{children}</>;
  };
  
  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-xs text-gray-600">Loading data...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-1">
      <ErrorBoundary>
        <Card className="w-full p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-1 pt-0">
            <CardTitle className="text-xs">
              Company wise SBU Level Month Wise Performance
            </CardTitle>

            <Select
              value={selectedCompany}
              onValueChange={handleCompanyChange}
              defaultValue="HPCL"
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company} value={company} className="text-xs">
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-2 relative">
            {isLoading && <LoadingOverlay />}
            <div 
              ref={chartRef} 
              className="h-[300px]"
              role="region"
              aria-label="Industry performance variance heatmap"
            />
          </CardContent>
        </Card>

        <Card className="w-full p-0">
          <CardHeader className="p-1">
            <CardTitle className="text-xs">SBU Level Month Wise</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="grid grid-cols-1 gap-1 p-0 pt-1">
              <SBUlevelAgGrid data={data} />
            </div>
          </CardContent>
        </Card>
      </ErrorBoundary>
    </div>
  );
};

export default IndustryHeatmap;