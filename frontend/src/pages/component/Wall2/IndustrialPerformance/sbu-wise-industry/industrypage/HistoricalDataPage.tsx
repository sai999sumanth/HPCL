import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/services/apiClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/@/components/ui/table';
import { Button } from '@/@/components/ui/button';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';

interface HistoricalData {
  year: string;
  sales: number;
  growth: number;
  marketShare: number;
}

const HistoricalDataPage: React.FC = () => {
  const [data, setData] = useState<HistoricalData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistoricalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        filters: [
          { key: '"sbu_name"', cond: "equals", value: "RETAIL" },
          { key: '"zone_name"', cond: "equals", value: "" },
          { key: '"region_name"', cond: "equals", value: "KOTA" },
          { key: '"fiscal_year"', cond: "in", value: "" },
          { key: '"productname"', cond: "equals", value: "" },
          { key: '"coname"', cond: "equals", value: "HPCL" },
          { key: '"distname"', cond: "equals", value: "" },
          { key: '"statename"', cond: "equals", value: "All" },
          { key: '"month_name"', cond: "equals", value: "" }
        ],
        cross_filters: [],
        action: "industry_performance",
        drill_state: "",
        time_grain: "",
        resp_format: "historical_years"
      };

      // Simulating API call with mock data
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockResponse: HistoricalData[] = [
        { year: "2022-2023", sales: 850.5, growth: 5.2, marketShare: 32.1 },
        { year: "2023-2024", sales: 920.1, growth: 8.2, marketShare: 33.5 },
        { year: "2024-2025", sales: 980.7, growth: 6.6, marketShare: 34.0 },
      ];
      // const response = await apiClient.post('/api/charts/generate_vis_data', payload);
      // setData(response.data);
      setData(mockResponse);

    } catch (err) {
      setError('Failed to fetch historical data. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoricalData();
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-lg text-gray-600">Loading Data...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-red-50 p-6 rounded-lg">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="mt-4 text-lg text-red-700">{error}</p>
          <Button onClick={fetchHistoricalData} className="mt-6">
            Retry
          </Button>
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="text-center min-h-[300px] flex items-center justify-center">
          <p className="text-lg text-gray-500">No historical data found for the specified filters.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Year</TableHead>
            <TableHead className="text-right">Sales (TMT)</TableHead>
            <TableHead className="text-right">Growth (%)</TableHead>
            <TableHead className="text-right">Market Share (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.year}>
              <TableCell className="font-medium">{item.year}</TableCell>
              <TableCell className="text-right">{item.sales.toFixed(2)}</TableCell>
              <TableCell className="text-right">{item.growth.toFixed(2)}</TableCell>
              <TableCell className="text-right">{item.marketShare.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        hje vhdf hvfhdv dcjhhdhcd h
        <div className="mb-6">
            <Button asChild variant="outline" size="sm">
                <Link to="/" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                </Link>
            </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Historical Performance Data</CardTitle>
            <p className="text-sm text-gray-500 pt-1">
              Displaying historical data for SBU: RETAIL, Region: KOTA, Company: HPCL
            </p>
          </CardHeader>
          <CardContent>
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HistoricalDataPage;
