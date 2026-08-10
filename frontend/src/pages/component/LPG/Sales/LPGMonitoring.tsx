import { Card, CardContent } from "@/@/components/ui/card";
import ZonePlantSelections from "../../RetailOutletHome/ZonePlantSelections";
import { useEffect, useState } from "react";
import axios from "axios";
import { apiClient } from "@/services/apiClient";

// Define TypeScript interfaces for the data structure
interface LocationFilter {
  zone?: string;
  plant?: string;
}

interface SaleData {
  dom?: number;
  non_dom?: number;
  bulk?: number;
}

interface TankageData {
  total?: number;
  not_in_ops?: number;
  op_tankage?: number;
  stock_percentage?: number;
}

interface DaysCoverStock {
  dom?: number;
  non_dom?: number;
}

interface DashboardData {
  stock?: number;
  current_inventory?: number;
  opening_stock?: SaleData;
  tankage?: TankageData;
  avg_sales?: SaleData;
  days_cover?: number;
  days_cover_stock?: DaysCoverStock;
  in_transit?: number;
  receipt_stock?: number;
  hpcl_sales?: SaleData;
  omc_sales?: SaleData;
  stock_transfers?: SaleData;
}

// Helper function to format labels
const formatLabel = (label: string): string => {
  const labelMap: Record<string, string> = {
    'dom': 'Dom',
    'non_dom': 'Non Dom',
    'bulk': 'Bulk',
    'TOTAL': 'Total',
    'NOT IN OPS': 'Not in Ops',
    'OP TANKAGE': 'Op Tankage'
  };

  // First check exact match in labelMap
  if (labelMap[label]) return labelMap[label];

  // If no exact match, do some general formatting
  return label
    .split('_')
    .map(word => word)
    .join(' ');
};

// Card component for displaying metric values
interface MetricCardProps {
  label: string;
  value: number | string | undefined;
}

const MetricCard = ({ label, value }: MetricCardProps) => (
  <Card className="p-2 text-center shadow-md">
    <CardContent className="p-2">
      <h3 className="text-md font-medium text-gray-600">{formatLabel(label)}</h3>
      <p className="text-2xl font-bold">{value !== undefined ? String(value) : 'N/A'}</p>
    </CardContent>
  </Card>
);

// Section component with title header and content
interface SectionProps {
  title: string;
  backgroundColor?: string;
  children: React.ReactNode;
}

const Section = ({ title, backgroundColor = "bg-gray-200", children }: SectionProps) => (
  <div className="space-y-2">
    <h2 className={`text-lg font-semibold ${backgroundColor} p-2 rounded-md text-center`}>{title}</h2>
    {children}
  </div>
);

export default function LPGStockDashboard() {
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({});
  const [data, setData] = useState<DashboardData>({
    stock: undefined,
    current_inventory: undefined,
    opening_stock: {},
    tankage: {},
    avg_sales: {},
    days_cover: undefined,
    days_cover_stock: {},
    in_transit: undefined,
    receipt_stock: undefined,
    hpcl_sales: {},
    omc_sales: {},
    stock_transfers: {}
  });

  const fetchPlantAnalytics = async () => {
    let payload = {
      "filters": [
        {"key": '"zone_name"', "cond": "=", "val": locationFilter?.zone},
        {"key": '"plant_name"', "cond": "=", "val": locationFilter?.plant}
      ],
      "cross_filters": [],
      "action": "lpg_plant_analysis",
      "drill_state": "",
      "limit": 0,
      "time_grain": "",
      "resp_format": "",
      "resp_level": ""
    };

    try {
      const response = await apiClient.post("/api/charts/generate_vis_data", payload);
      console.log("response data", response.data);
      setData(response.data || {
        stock: undefined,
        current_inventory: undefined,
        opening_stock: {},
        tankage: {},
        avg_sales: {},
        days_cover: undefined,
        days_cover_stock: {},
        in_transit: undefined,
        receipt_stock: undefined,
        hpcl_sales: {},
        omc_sales: {},
        stock_transfers: {}
      });
    } catch (error) {
      console.error("Error fetching plant analytics:", error);
      // Reset data to empty state if API call fails
      setData({
        stock: undefined,
        current_inventory: undefined,
        opening_stock: {},
        tankage: {},
        avg_sales: {},
        days_cover: undefined,
        days_cover_stock: {},
        in_transit: undefined,
        receipt_stock: undefined,
        hpcl_sales: {},
        omc_sales: {},
        stock_transfers: {}
      });
    }
  };

  useEffect(() => {
    fetchPlantAnalytics();
  }, [locationFilter]);
  
  const handleZoneChange = (zone: string) => {
    setLocationFilter((prev) => ({
      ...prev,
      zone,
      plant: undefined,
    }));
  };

  const handlePlantChange = (plant: string) => {
    setLocationFilter((prev) => ({
      ...prev,
      plant,
    }));
  };

  // Format current date and time for display
  const getCurrentDateTime = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} Time ${hours}:${minutes}`;
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">LPG Plant Stock Monitoring</h1>
          <p className="text-sm">As of {getCurrentDateTime()}</p>
        </div>
        <div>
          <div className="mt-2">
            <ZonePlantSelections
              bu="LPG"
              onZoneChange={handleZoneChange}
              onPlantChange={handlePlantChange}
              hideAlertType={true}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Opening Stock Section */}
          <Section title="Opening Stock" backgroundColor="bg-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <MetricCard label="Dom(TMT)" value={data?.opening_stock?.dom} />
              <MetricCard label="Non Dom(TMT)" value={data?.opening_stock?.non_dom} />
            </div>
          </Section>

          {/* Average Sales Section */}
          <Section title="Average Sales" backgroundColor="bg-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <MetricCard label="Dom(TMT)" value={data?.avg_sales?.dom} />
              <MetricCard label="Non Dom(TMT)" value={data?.avg_sales?.non_dom} />
            </div>
          </Section>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Tankage Section */}
          <Section title="Tankage" backgroundColor="bg-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <MetricCard label="Op Tankage(TMT)" value={data?.tankage?.op_tankage} />
              <MetricCard 
                label="% of Stock" 
                value={data?.tankage?.stock_percentage !== undefined ? 
                  (data.tankage.stock_percentage / 100) : undefined} 
              />
            </div>
          </Section>

          {/* Days Cover Section */}
          <Section title="Days Cover" backgroundColor="bg-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <MetricCard label="Dom(Days)" value={data?.days_cover_stock?.dom} />
              <MetricCard label="Non Dom(Days)" value={data?.days_cover_stock?.non_dom} />
            </div>
          </Section>
        </div>
      </div>

      {/* Commented out for future use
      <div className="flex space-x-4">
        <StockSection 
          title="Opening Stock (TMT)" 
          items={
            data?.stock
              ? [['Opening Stock', data.stock]] 
              : []
          } 
        />
        <Section 
          title="Days Cover" 
          items={data?.days_cover !== null ? [['Days Cover', data.days_cover]] : []} 
        />
        <Section 
          title="In Transit (TMT)" 
          items={data?.in_transit !== null ? [['In Transit', data.in_transit]] : []} 
        />
      </div>

      <div className="gap-3">
        <AverageSalesSection 
          title="Average Throughput (TMT)" 
          items={
            data?.avg_sales && Object.keys(data.avg_sales).length > 0 
              ? Object.entries(data.avg_sales) 
              : []
          } 
        />
      </div>
      <div className="flex gap-3">
          <AverageSalesSection 
            title="HPCL Sales (TMT)" 
            items={
              data?.hpcl_sales && Object.keys(data.hpcl_sales).length > 0 
                ? Object.entries(data.hpcl_sales) 
                : []
            } 
          />
          <AverageSalesSection
            title="OMC Sales (TMT)" 
            items={
              data?.omc_sales && Object.keys(data.omc_sales).length > 0 
                ? Object.entries(data.omc_sales) 
                : []
            }
          />
          <AverageSalesSection 
            title="Stock Transfers (TMT)" 
            items={
              data?.stock_transfers && Object.keys(data.stock_transfers).length > 0 
                ? Object.entries(data.stock_transfers) 
                : []
            }  
          />
      </div>
      */}
    </div>
  );
}