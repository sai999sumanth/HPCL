import { Card, CardHeader, CardTitle } from '@/@/components/ui/card';
import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5themes_Responsive from "@amcharts/amcharts5/themes/Responsive";
import { Separator } from '@/@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/@/components/ui/dialog';
import { X, Loader2, TrendingUp, PieChart, BarChart3, Target, History, ArrowLeft } from 'lucide-react';
import SbuWiseBigNumbersTable from './sbuwiseBigNumbersTable';
import { Button } from '@/@/components/ui/button';
import { apiClient } from '@/services/apiClient';

interface ChartDataPoint {
  company_name: string;
  value: number;
}

/** High-contrast pill behind bar value labels (readable on any column color). */
const barValueLabelBackground = (root: am5.Root) =>
  am5.RoundedRectangle.new(root, {
    fill: am5.color(0xffffff),
    fillOpacity: 0.97,
    stroke: am5.color(0x475569),
    strokeOpacity: 0.95,
    strokeWidth: 1,
    cornerRadiusTL: 4,
    cornerRadiusTR: 4,
    cornerRadiusBL: 4,
    cornerRadiusBR: 4,
  });

interface ItemData {
  sbu_name?: string;
  zone_name?: string;
  [key: string]: any; 
}

interface ApiDataItem {
  ro?: string;
  statename?: string;
  distname?: string; 
  sbu_name?: string;
  [key: string]: any;
}

interface SbuWiseDynamicSBUChartProps {
  data: ItemData[];
  allsbudata?: any;
  selectedItems: string[];
  type: string;
  title?: string;
  companycolors?: any;
  selectedYear: any;
  sbu: any;
  isCumulative: any;
  selectedCompanies: any;
  selectedCategory: any;
}

interface PopupDrilldown {
  level: 1 | 2 | 3;
  zone: string;
  region?: string;
  state?: string;
}

const SbuWiseDynamicSBUChart: React.FC<SbuWiseDynamicSBUChartProps> = ({ 
  data, 
  allsbudata, 
  selectedItems, 
  type, 
  title, 
  companycolors, 
  selectedYear,
  sbu,
  isCumulative,
  selectedCompanies,
  selectedCategory
}) => {
  companycolors = [
    { "name": "HPCL", "color": "#1D4ED8" }, { "name": "BPCL", "color": "#FBBF24" },
    { "name": "IOCL", "color": "#EA580C" }, { "name": "RIL", "color": "#A855F7" },
    { "name": "Nyra", "color": "#14B8A6" }, { "name": "Shell", "color": "#A16207" },
    { "name": "MRPL", "color": "#4D7C0F" }, { "name": "GAIL", "color": "#991B1B" },
    { "name": "CPCL", "color": "#44403C" }, { "name": "HMEL", "color": "#052E16" },
    { "name": "NRL", "color": "#3B0764" }, { "name": "NEL", "color": "#0048A8" },
    { "name": "OIL", "color": "#1F2937" }, { "name": "SMA", "color": "#4A044E" },
    { "name": "BURL", "color": "#9D174D" }, { "name": "OtherPSU", "color": "#6B7280" },
    { "name": "PVT", "color": "#374151" }
  ];
  
  const COMPANY_SORT_ORDER = [
    "HPCL", "BPCL", "IOCL", "RIL", "Nyra", "Shell", 
    "MRPL", "GAIL", "CPCL", "HMEL", "NRL", "NEL",
    "OIL", "SMA", "BURL", "PSU", "PVT"
  ];
  
  const chartRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const chartRoots = useRef<{ [key: string]: am5.Root | null }>({});
  const [errorMessage, setErrorMessage] = useState('');
  
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupDrilldown, setPopupDrilldown] = useState<PopupDrilldown | null>(null);
  const [popupData, setPopupData] = useState<ApiDataItem[] | null>(null);
  const [isLoadingPopup, setIsLoadingPopup] = useState(false);
  const [popupError, setPopupError] = useState<string>('');
  const [activeTab, setActiveTab] = useState('Sales');
  
  const popupChartRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const popupChartRoots = useRef<{ [key: string]: am5.Root | null }>({});

  const tabs = [
    { id: 'Sales', label: 'Sales', icon: BarChart3 },
    { id: 'Growth', label: 'Growth (%)', icon: TrendingUp },
    { id: 'History', label: 'History', icon: History },
    { id: 'Market Share', label: 'Market Share (%)', icon: PieChart },
    { id: 'Market Share History', label: 'Mkt Share History', icon: Target }
  ];

  const getDataForSelectedItems = (items: string[]): ItemData[] => {
    return data.filter((item) => items.includes(item.zone_name || item.sbu_name));
  };

  const fetchPerformanceData = async (drilldown: PopupDrilldown) => {
    setIsLoadingPopup(true);
    setPopupError('');
    setPopupData(null);

    const { level, zone, region, state } = drilldown;

    const filters: any[] = [
      { key: '"fiscal_year"', cond: "in", value: selectedYear },
      { key: '"sbu_name"', cond: "equals", value: sbu.toUpperCase() },
      { key: '"zone_name"', cond: "equals", value: zone },
      { key: '"ind_sbu_cumulative"', cond: "equals", value: isCumulative.toString() },
      { key: '"coname"', cond: "equals", value: (selectedCompanies as string[]).map((c: string) => c.toUpperCase()).join(",") },
      { key: '"cogroup"', cond: "equals", value: selectedCategory },
      { key: "\"month_name\"", cond: "equals", value: "APR,MAY,JUN,JUL,AUG,SEP,OCT,NOV,DEC,JAN,FEB,MAR" }
    ];

    let drill_state = "";
    if (level === 1) {
      drill_state = "ro";
    } else if (level === 2 && region) {
      drill_state = "statename";
      filters.push({ key: '"ro"', cond: "equals", value: region });
    } else if (level === 3 && region && state) {
      drill_state = "distname";
      filters.push({ key: '"ro"', cond: "equals", value: region });
      filters.push({ key: '"statename"', cond: "equals", value: state });
    }

    const payload = {
      filters,
      cross_filters: [],
      action: "industry_performance",
      drill_state,
      time_grain: "",
      resp_format: "omc_compare"
    };

    try {
      const response = await apiClient.post('/api/charts/generate_vis_data', payload);
      if (response.data && Array.isArray(response.data)) {
        setPopupData(response.data);
      } else {
        throw new Error("Invalid data format received from API.");
      }
    } catch (error: any) {
      setPopupError(error.message || 'Failed to fetch data');
      setPopupData(null);
    } finally {
      setIsLoadingPopup(false);
    }
  };

  const handleZoneClick = (zoneName: string) => {
    setPopupDrilldown({ level: 1, zone: zoneName });
    setIsPopupOpen(true);
    setActiveTab('Sales');
  };
  
  const handleRegionClick = (regionName: string) => {
    if(popupDrilldown?.zone) {
      setPopupDrilldown({ level: 2, zone: popupDrilldown.zone, region: regionName });
    }
  };

  const handleStateClick = (stateName: string) => {
    if (popupDrilldown?.zone && popupDrilldown?.region) {
        setPopupDrilldown({ 
            level: 3, 
            zone: popupDrilldown.zone, 
            region: popupDrilldown.region, 
            state: stateName 
        });
    }
  };

  const handlePopupBack = () => {
    if (popupDrilldown?.level === 3 && popupDrilldown.zone && popupDrilldown.region) {
      setPopupDrilldown({ level: 2, zone: popupDrilldown.zone, region: popupDrilldown.region });
    } else if (popupDrilldown?.level === 2 && popupDrilldown.zone) {
      setPopupDrilldown({ level: 1, zone: popupDrilldown.zone });
    }
  };

  useEffect(() => {
    if (isPopupOpen && popupDrilldown) {
      fetchPerformanceData(popupDrilldown);
    }
  }, [isPopupOpen, popupDrilldown]);

const createPopupChart = (
  chartDiv: HTMLDivElement,
  item: ApiDataItem,
  chartTitle: string,
  dataKey: string,
  categoryField: 'ro' | 'statename' | 'distname'
) => {
  const categoryValue = item[categoryField];
  if (!item || !categoryValue) return;

  const root = am5.Root.new(chartDiv);
  popupChartRoots.current[categoryValue] = root;

  const responsive = am5themes_Responsive.new(root);
  root.setThemes([am5themes_Animated.new(root), responsive]);
  root._logo?.dispose();

const chart = root.container.children.push(
  am5xy.XYChart.new(root, {
    panX: false, panY: false, wheelX: "none", wheelY: "none",
    layout: root.verticalLayout,
    paddingTop: 28,
    paddingBottom: 10,
    paddingLeft: 15,
    paddingRight: 15,
  })
);
  
  const companyData = item[dataKey];
  if (!companyData || typeof companyData !== 'object') {
    chart.children.unshift(am5.Label.new(root, { text: `No data for ${chartTitle} in ${categoryValue}`, x: am5.p50, centerX: am5.p50, y: am5.p50, centerY: am5.p50 }));
    return;
  }

  const chartDataForItem: ChartDataPoint[] = Object.keys(companyData)
    .map(company => ({
      company_name: company,
      value: companyData[company]
    }))
    .filter(item => item.value !== null && item.value !== undefined);
    
  chartDataForItem.sort((a, b) => {
    const indexA = COMPANY_SORT_ORDER.indexOf(a.company_name);
    const indexB = COMPANY_SORT_ORDER.indexOf(b.company_name);
    return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
  });

  const isPercentage = chartTitle.includes('(%)');

  const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
    categoryField: "company_name",
    renderer: am5xy.AxisRendererX.new(root, { 
      minGridDistance: 20, 
      cellStartLocation: 0.2, 
      cellEndLocation: 0.8 
    }),
  }));
  xAxis.get("renderer").labels.template.setAll({ 
    rotation: -45, 
    centerY: am5.p50, 
    centerX: am5.p100, 
    fontSize: 8, // Decreased from 10 to 8
    fontWeight: "500" 
  });
  xAxis.data.setAll(chartDataForItem);

const hasNegativePopup = chartDataForItem.some((d) => Number(d.value) < 0);
const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
    renderer: am5xy.AxisRendererY.new(root, {}),
    strictMinMax: false,
    // Generous headroom so value pills above positive columns are not clipped
    extraMax: 0.4,
    ...(hasNegativePopup ? { extraMin: 0.12 } : {}),
}));


  // Decreased Y-axis label font size as well
  yAxis.get("renderer").labels.template.setAll({ 
    fontSize: 8 // Decreased from default to 8
  });
  yAxis.set("numberFormat", isPercentage ? "#'%'": "#,###.##");

  const series = chart.series.push(am5xy.ColumnSeries.new(root, {
    xAxis: xAxis,
    yAxis: yAxis,
    valueYField: "value",
    categoryXField: "company_name",
    tooltip: am5.Tooltip.new(root, {
      labelText: `{categoryX}: {valueY}${isPercentage ? '%' : ''}`
    })
  }));

  series.columns.template.setAll({ cornerRadiusTL: 3, cornerRadiusTR: 3, strokeOpacity: 0 });

  if (categoryField === 'ro') {
      series.columns.template.set("cursorOverStyle", "pointer");
      series.columns.template.events.on("click", () => handleRegionClick(categoryValue));
  } else if (categoryField === 'statename') {
      series.columns.template.set("cursorOverStyle", "pointer");
      series.columns.template.events.on("click", () => handleStateClick(categoryValue));
  }

  // FIXED: Proper color adapter for popup charts - this ensures each company gets its designated color
  series.columns.template.adapters.add("fill", (fill, target) => {
    const dataContext = target.dataItem?.dataContext as ChartDataPoint;
    if (dataContext && dataContext.company_name) {
      // Handle negative values with red color
      // if (dataContext.value < 0) {
      //   return am5.color("#ff6347"); // Tomato color for negative values
      // }
      
      // Find company color from the companycolors array - using same logic as main charts
      const companyColor = companycolors.find((item: any) => item.name === dataContext.company_name);
      if (companyColor) {
        return am5.color(companyColor.color);
      }
    }
    
    // Default color if no match found
    return am5.color("#5e74e9");
  });

  // Ensure proper opacity and hover states
  series.columns.template.setAll({ 
    cornerRadiusTL: 3, 
    cornerRadiusTR: 3, 
    strokeOpacity: 0,
    fillOpacity: 0.9
  });

  // Add hover state for better visual feedback
  series.columns.template.states.create("hover", { 
    fillOpacity: 1.0,
    scale: 1.05
  });

  series.bullets.push(() => {
    const bulletLabel = am5.Label.new(root, {
      text: isPercentage ? "{valueY.formatNumber('#.0')}%" : "{valueY.formatNumber('#,###')}",
      fill: am5.color(0x0f172a),
      centerX: am5.p50,
      fontSize: 9,
      rotation: -15,
      fontWeight: "bold",
      populateText: true,
      oversizedBehavior: "none",
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 5,
      paddingRight: 5,
      background: barValueLabelBackground(root),
    });
    const bullet = am5.Bullet.new(root, {
      locationY: 1,
      sprite: bulletLabel,
    });
    // Negative columns: locationY 1 sits on the bottom tip (clipped). Use base (0) + dy up.
    bullet.adapters.add("locationY", (_ly, b) => {
      const di = (b as unknown as { dataItem?: am5.DataItem<am5xy.IColumnSeriesDataItem> }).dataItem;
      return di && di.get("valueY") < 0 ? 0 : 1;
    });
    bulletLabel.adapters.add("dy", (_dy, target) => {
      const dataItem = target.dataItem as am5.DataItem<am5xy.IColumnSeriesDataItem>;
      if (dataItem && dataItem.get("valueY") < 0) return -20;
      return -18;
    });
    return bullet;
  });

  series.data.setAll(chartDataForItem);

  chart.children.unshift(am5.Label.new(root, {
    text: `${categoryValue}`,
    fontSize: 12, fontWeight: "600", textAlign: "center",
    x: am5.p50, centerX: am5.p50, paddingBottom: 10
  }));

  chart.appear(1000, 100);
};

  useEffect(() => {
    Object.values(popupChartRoots.current).forEach(root => root?.dispose());
    popupChartRoots.current = {};

    if (popupData && isPopupOpen && !isLoadingPopup) {
      const categoryField = popupDrilldown?.level === 1 ? 'ro' : (popupDrilldown?.level === 2 ? 'statename' : 'distname');
      const dataToRender = popupData.filter(d => d[categoryField]);
      const activeTabData = tabs.find(t => t.id === activeTab);

      if (dataToRender.length > 0 && activeTabData) {
        dataToRender.forEach(item => {
          const key = item[categoryField];
          if (key) {
            const chartDiv = popupChartRefs.current[key];
            if (chartDiv) {
              createPopupChart(chartDiv, item, activeTabData.label, activeTabData.id, categoryField);
            }
          }
        });
      }
    }
    
    return () => {
        Object.values(popupChartRoots.current).forEach(root => root?.dispose());
        popupChartRoots.current = {};
    };
  }, [activeTab, popupData, isPopupOpen, isLoadingPopup, popupDrilldown]);

  useLayoutEffect(() => {
    const filteredData = getDataForSelectedItems(selectedItems);
    if (filteredData.length === 0) setErrorMessage("No data available for selected items.");
    else setErrorMessage("");
    
    Object.values(chartRoots.current).forEach(root => root?.dispose());
    chartRoots.current = {};

    selectedItems.forEach((itemName) => {
      const chartDiv = chartRefs.current[itemName];
      const itemData = filteredData.find((d) => (d.zone_name || d.sbu_name) === itemName);

      if (chartDiv && itemData) {
        const root = am5.Root.new(chartDiv);
        chartRoots.current[itemName] = root;
        const responsive = am5themes_Responsive.new(root);
        root.setThemes([am5themes_Animated.new(root), responsive]);
        root._logo?.dispose();
const chart = root.container.children.push(
  am5xy.XYChart.new(root, {
    panX: false, panY: false, wheelX: "none", wheelY: "none",
    layout: root.verticalLayout,
    paddingTop: 28,
    paddingBottom: 10,
    paddingLeft: 15,
    paddingRight: 15,
  })
);


        const chartData: ChartDataPoint[] = Object.keys(itemData[type] || {}).map((company) => ({
            company_name: company, value: itemData[type][company],
        }));
        chartData.sort((a, b) => {
            const indexA = COMPANY_SORT_ORDER.indexOf(a.company_name);
            const indexB = COMPANY_SORT_ORDER.indexOf(b.company_name);
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });
        const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: "company_name",
            renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 15 }),
        }));
        const xRenderer = xAxis.get("renderer");
        xRenderer.labels.template.setAll({
            fontSize: 9, rotation: -45, centerY: am5.p50,
            centerX: am5.p100, paddingRight: 1, fontWeight: "bold",
        });
        xAxis.data.setAll(chartData);
        
const hasNegativeMain = chartData.some((d) => Number(d.value) < 0);
const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
    strictMinMax: false,
    renderer: am5xy.AxisRendererY.new(root, {
        strokeOpacity: 0.1, 
        minGridDistance: 30,
    }),
    extraMax: 0.4,
    ...(hasNegativeMain ? { extraMin: 0.12 } : {}),
}));


        yAxis.get("renderer").labels.template.setAll({ fontSize: 10 });
        yAxis.children.unshift(am5.Label.new(root, {
            rotation: -90, text: title, y: am5.p50,
            centerX: am5.p50, fontSize: 10, paddingBottom: 0,
        }));
        const series = chart.series.push(am5xy.ColumnSeries.new(root, {
            name: type, xAxis: xAxis, yAxis: yAxis,
            valueYField: "value", categoryXField: "company_name",
            tooltip: am5.Tooltip.new(root, { pointerOrientation: "horizontal", labelText: `[bold]${title}[/] of {company_name}: {valueY}` }),
        }));
        series.columns.template.setAll({
            cornerRadiusTL: 3, cornerRadiusTR: 3, strokeOpacity: 0,
            width: am5.percent(30), tooltipY: 0, cursorOverStyle: "pointer", fillOpacity: 0.8,
        });
        series.columns.template.events.on("click", () => handleZoneClick(itemName));
        const chartTitleLabel = chart.children.unshift(am5.Label.new(root, {
            text: `${title} - ${itemName}`, fontSize: 10, fontWeight: "500",
            textAlign: "center", x: am5.p50, centerX: am5.p50,
        }));
        
        series.bullets.push(() => {
            const bulletLabel = am5.Label.new(root, {
                text: (type === 'Sales' || type === 'Volume G/L') ? "{valueY.formatNumber()}" : "{valueY.formatNumber('#')}%",
                fill: am5.color(0x0f172a),
                centerX: am5.p50,
                fontSize: 10,
                rotation: -15,
                fontWeight: "bold",
                populateText: true,
                oversizedBehavior: "none",
                paddingTop: 2,
                paddingBottom: 2,
                paddingLeft: 5,
                paddingRight: 5,
                background: barValueLabelBackground(root),
            });
            const bullet = am5.Bullet.new(root, {
                locationY: 1,
                sprite: bulletLabel,
            });
            bullet.adapters.add("locationY", (_ly, b) => {
                const di = (b as unknown as { dataItem?: am5.DataItem<am5xy.IColumnSeriesDataItem> }).dataItem;
                return di && di.get("valueY") < 0 ? 0 : 1;
            });
            bulletLabel.adapters.add("dy", (_dy, target) => {
                const dataItem = target.dataItem as am5.DataItem<am5xy.IColumnSeriesDataItem>;
                if (dataItem && dataItem.get("valueY") < 0) return -20;
                return -18;
            });
            return bullet;
        });
        
        responsive.addRule({
            relevant: am5themes_Responsive.widthL,
            applying: () => {
                xRenderer.labels.template.set("fontSize", 9);
                chartTitleLabel.set("fontSize", 10);
                yAxis.get("renderer").labels.template.set("fontSize", 10);
            },
            removing: () => {
                xRenderer.labels.template.set("fontSize", 8);
                chartTitleLabel.set("fontSize", 12);
                yAxis.get("renderer").labels.template.set("fontSize", 8);
            }
        });

        series.columns.template.adapters.add("fill", (fill, target) => {
            const dataContext = target.dataItem?.dataContext as ChartDataPoint;
            const companyData = companycolors.find((item: any) => item.name === dataContext?.company_name);
            return companyData ? am5.color(companyData.color) : am5.color(0x5e74e9);
        });
        series.columns.template.states.create("hover", { fillOpacity: 1 });
        series.data.setAll(chartData);
        chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "none", xAxis: xAxis, yAxis: yAxis }));
        chart.appear(1000, 100);
        series.appear(1000);
      }
    });
    return () => {
      Object.values(chartRoots.current).forEach(root => root?.dispose());
      chartRoots.current = {};
    };
  }, [selectedItems, type, title, data, companycolors, sbu, selectedYear, isCumulative, selectedCompanies, selectedCategory]);

  const getPopupTitle = () => {
    if (!popupDrilldown) return "";
    const { level, zone, region, state } = popupDrilldown;
    if (level === 1) return `Region Performance - ${zone}`;
    if (level === 2) return `State Performance - ${region} (${zone})`;
    if (level === 3) return `District Performance - ${state} (${region})`;
    return "";
  };

  const getPopupSubtitle = () => {
    if (popupDrilldown?.level === 1) return "(Click on a region's chart to drill down to states)";
    if (popupDrilldown?.level === 2) return "(Click on a state's chart to drill down to districts)";
    return null;
  }

  const categoryField = popupDrilldown?.level === 1 ? 'ro' : popupDrilldown?.level === 2 ? 'statename' : 'distname';
  const currentData = popupData?.filter(d => d[categoryField]);
  
  const companies = React.useMemo(() => {
    if (!currentData) return [];
    const companySet = new Set<string>();
    currentData.forEach(item => {
      tabs.forEach(tab => {
        if (item[tab.id] && typeof item[tab.id] === 'object') {
          Object.keys(item[tab.id]).forEach(company => companySet.add(company));
        }
      });
    });
    return Array.from(companySet).sort((a, b) => {
      const indexA = COMPANY_SORT_ORDER.indexOf(a);
      const indexB = COMPANY_SORT_ORDER.indexOf(b);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });
  }, [currentData]);
  
  const activeTabData = tabs.find(t => t.id === activeTab);

  const renderDataTable = () => {
    if (!activeTabData || !currentData || !currentData.some(r => r[activeTabData.id])) return null;

    const currentCategoryField = popupDrilldown?.level === 1 ? 'ro' : popupDrilldown?.level === 2 ? 'statename' : 'distname';
    const categoryHeader = popupDrilldown?.level === 1 ? 'Region' : popupDrilldown?.level === 2 ? 'State' : 'District';

    return (
      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-3">{activeTabData.label} - Data</h4>
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{categoryHeader}</th>
                {companies.map(c => <th key={c} className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{c}</th>)}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentData.map((item, index) => {
                const key = item[currentCategoryField] || index;
                return (
                  <tr key={key}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item[currentCategoryField]}</td>
                    {companies.map(c => (
                      <td key={c} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                        {item[activeTabData.id]?.[c]?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'N/A'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const chartGridClass =
    !currentData || currentData.length === 0
      ? ""
      : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8";

  return (
    <div>
      <Card className="p-2">
        <CardHeader className="">
            <CardTitle className="text-lg font-semibold">
                Performance Metrics
            </CardTitle>
            <p className="text-xs text-gray-500">
                (Click on chart bars to view region-wise data)
            </p>
        </CardHeader>
        {errorMessage && <div className="text-red-500 mb-4 px-4">{errorMessage}</div>}
        {allsbudata && allsbudata.length > 0 && <SbuWiseBigNumbersTable data={allsbudata} type={type} companyOrder={COMPANY_SORT_ORDER} /> }
        <Separator />
        <div className={`grid ${selectedItems.length > 1 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4 pt-2`}>
          {selectedItems.map((itemName) => (
            <div 
              key={itemName}
              ref={(el) => { chartRefs.current[itemName] = el; }}
              className="w-full h-[300px]"
            ></div>
          ))}
        </div>
      </Card>

      <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
        <DialogContent className="max-w-7xl w-full max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-4">
              {popupDrilldown && popupDrilldown.level > 1 && (
                <Button variant="ghost" size="icon" onClick={handlePopupBack} className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <DialogTitle>{getPopupTitle()}</DialogTitle>
                <p className="text-xs text-gray-500 mt-1">{getPopupSubtitle()}</p>
              </div>
            </div>
            <DialogClose asChild><button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"><X className="h-4 w-4" /><span className="sr-only">Close</span></button></DialogClose>
          </DialogHeader>
          
          <div className="mt-4">
            {isLoadingPopup && <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><span className="ml-3 text-gray-600">Loading...</span></div>}
            {popupError && <div className="bg-red-50 border border-red-200 rounded-lg p-4"><div className="flex items-start"><X className="h-5 w-5 text-red-400 mt-0.5" /><div className="ml-3"><h3 className="text-sm font-medium text-red-800">Error</h3><p className="text-sm text-red-700 mt-1">{popupError}</p></div></div><button onClick={() => popupDrilldown && fetchPerformanceData(popupDrilldown)} className="mt-3 px-3 py-1 text-sm border border-red-300 rounded hover:bg-red-100">Retry</button></div>}
            
            {!isLoadingPopup && !popupError && popupData && (
              <div>
                <div className="border-b border-gray-200 mb-6">
                  <nav className="-mb-px flex flex-wrap space-x-8" aria-label="Tabs">
                    {tabs.map((tab) => (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}>
                        <tab.icon className="h-4 w-4" />{tab.label}
                      </button>
                    ))}
                  </nav>
                </div>

                {currentData && currentData.length > 0 ? (
                  <div>
                    <div className={chartGridClass}>
                      {currentData.map(item => {
                        const key = item.ro || item.statename || item.distname;
                        return key ? (
                          <div
                            key={key}
                            ref={el => { if(key) popupChartRefs.current[key] = el; }}
                            className="w-full h-[320px] bg-white rounded-lg border p-2"
                          />
                        ) : null;
                      })}
                    </div>
                    {renderDataTable()}
                  </div>
                ) : <p className="text-center text-gray-500 py-8">No data available for this level.</p>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SbuWiseDynamicSBUChart;
