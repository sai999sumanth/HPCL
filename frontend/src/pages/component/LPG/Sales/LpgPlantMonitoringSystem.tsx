
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Card, 
  CardContent 
} from '@/@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/@/components/ui/select';
import { apiClient } from '@/services/apiClient';

interface Zone {
  name: string;
  id: string;
}

interface Plant {
  name: string;
  id: string;
}

export default function LPGPlantStockMonitoringDashboard() {
  const [stockData, setStockData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for dropdowns
  const [zones, setZones] = useState<Zone[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  
  // State to track selected zone and plant
  const [selectedBU] = useState<string>('LPG');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);

  // Fetch zones and initial data
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await apiClient.post('/api/indentdryout/get_distinct_location_details', {
          bu: selectedBU,
          zone: [],
          plant: []
        });

        if (response.data.status) {
          setZones(response.data.data.zone);
        }
      } catch (error) {
        console.error('Error fetching zones:', error);
      }
    };

    fetchZones();
  }, [selectedBU]);

  // Fetch plants when zone is selected
  useEffect(() => {
    const fetchPlants = async () => {
      if (selectedZone) {
        try {
          const response = await apiClient.post('/api/indentdryout/get_distinct_location_details', {
            bu: selectedBU,
            zone: [selectedZone],
            plant: []
          });

          if (response.data.status) {
            setPlants(response.data.data.plant);
          }
        } catch (error) {
          console.error('Error fetching plants:', error);
        }
      } else {
        setPlants([]);
      }
    };

    fetchPlants();
  }, [selectedZone, selectedBU]);

  // Fetch stock data based on selections
  useEffect(() => {
    const fetchStockData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Prepare filters based on selected zone and plant
        const filters = [];
        if (selectedZone) filters.push({ key: 'zone', cond: 'equals', value: selectedZone });
        if (selectedPlant) filters.push({ key: 'plant', cond: 'equals', value: selectedPlant });

        const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: filters,
          cross_filters: [],
          action: 'lpg_plant_analysis',
          drill_state: '',
          limit: 0,
          time_grain: '',
          resp_format: '',
          resp_level: ''
        });

        setStockData(response.data);
      } catch (error) {
        console.error('Error fetching stock data:', error);
        setError('Failed to fetch stock data');
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if zone is selected, or no zone selection is required
    if (selectedZone || (!selectedZone && !selectedPlant)) {
      fetchStockData();
    }
  }, [selectedZone, selectedPlant]); 

  // Render loading state
  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <p>Loading stock data...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No Data</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-bold">LPG Plant Monitoring</h1>
        
        {/* Zone and Plant Selections */}
        <div className="flex space-x-4">
          <div>
            {/* <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label> */}
            <Select 
              value={selectedZone || ''} 
              onValueChange={(value) => {
                setSelectedZone(value);
                setSelectedPlant(null); // Reset plant when zone changes
              }}
            >
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="Select Zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            {/* <label className="block text-sm font-medium text-gray-700 mb-1">Plant</label> */}
            <Select 
              value={selectedPlant || ''} 
              onValueChange={(value) => setSelectedPlant(value)}
              disabled={!selectedZone}
            >
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="Select Plant" />
              </SelectTrigger>
              <SelectContent>
                {plants.map((plant) => (
                  <SelectItem key={plant.id} value={plant.id}>
                    {plant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {stockData && (
        <div className="space-y-4">
          {/* Stock and Tankage Section */}
          <div className="grid grid-cols-4 gap-4">
            {/* Stock Section */}
            <div className="col-span-1">
              <h2 className="text-center text-sm font-bold rounded-lg mb-2 bg-blue-100 p-2">Stock</h2>
              <div className="grid grid-cols-2 gap-4">
                <Card className="h-32">
                  <CardContent className="flex flex-col items-center justify-center h-full">
                    <p className="text-sm">Opening Stock(TMT)</p>
                    <p className="text-2xl font-bold">{stockData.stock.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card className="h-32">
                  <CardContent className="flex flex-col items-center justify-center h-full">
                    <p className="text-sm">Recepient Stock(TMT)</p>
                    <p className="text-2xl font-bold">{stockData.current_inventory.toFixed(2)}</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Tankage Section */}
            <div className="col-span-3">
              <h2 className="text-center text-sm font-bold rounded-lg mb-2 bg-blue-100 p-2">Tankage</h2>
              <div className="grid grid-cols-4 gap-4">
                <Card className="h-32">
                  <CardContent className="flex flex-col items-center justify-center h-full">
                    <p className="text-sm">Total</p>
                    <p className="text-2xl font-bold">{stockData.tankage.total.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="h-32">
                  <CardContent className="flex flex-col items-center justify-center h-full">
                    <p className="text-sm">Not in Ops</p>
                    <p className="text-2xl font-bold">{stockData.tankage.not_in_ops}</p>
                  </CardContent>
                </Card>
                <Card className="h-32">
                  <CardContent className="flex flex-col items-center justify-center h-full">
                    <p className="text-sm">Op Tankage</p>
                    <p className="text-2xl font-bold">{stockData.tankage.op_tankage}</p>
                  </CardContent>
                </Card>
                <Card className="h-32">
                  <CardContent className="flex flex-col items-center justify-center h-full">
                    <p className="text-sm">% of Stock</p>
                    <p className="text-2xl font-bold">{stockData.tankage.stock_percentage}%</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Average Through Put Section */}
          <div>
            <h2 className="text-center text-sm font-bold rounded-lg mb-2 bg-blue-100 p-2">Average Through Put</h2>
            <div className="grid grid-cols-9 gap-4">
              {/* HPCL Sales */}
              <div className="col-span-3">
                <h3 className="text-center text-sm font-semibold rounded-lg mb-2 bg-blue-100 mb-2 p-2 ">HPCL Sales</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="h-32">
                    <CardContent className="flex flex-col items-center justify-center h-full">
                      <p className="text-sm">Dom(TMT)</p>
                      <p className="text-2xl font-bold">{stockData.hpcl_sales.dom.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className="h-32">
                    <CardContent className="flex flex-col items-center justify-center h-full">
                      <p className="text-sm">Non Dom(TMT)</p>
                      <p className="text-2xl font-bold">{stockData.hpcl_sales.non_dom.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className="h-32">
                    <CardContent className="flex flex-col items-center justify-center h-full">
                      <p className="text-sm">Bulk(TMT)</p>
                      <p className="text-2xl font-bold">{stockData.hpcl_sales.bulk.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* OMC Sales */}
              <div className="col-span-3">
                <h3 className="text-center text-sm font-semibold rounded-lg mb-2 bg-blue-100 mb-2 p-2 ">OMC Sales</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="h-32">
                    <CardContent className="flex flex-col items-center justify-center h-full">
                      <p className="text-sm">Dom(TMT)</p>
                      <p className="text-2xl font-bold">{stockData.omc_sales.dom.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className="h-32">
                    <CardContent className="flex flex-col items-center justify-center h-full">
                      <p className="text-sm">Non Dom(TMT)</p>
                      <p className="text-2xl font-bold">{stockData.omc_sales.non_dom.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className="h-32">
                    <CardContent className="flex flex-col items-center justify-center h-full">
                      <p className="text-sm">Bulk(TMT)</p>
                      <p className="text-2xl font-bold">{stockData.omc_sales.bulk.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Stock Transfers */}
              <div className="col-span-3">
                <h3 className="text-center text-sm font-semibold rounded-lg mb-2 bg-blue-100 mb-2 p-2 ">Stock Transfers</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="h-32">
                    <CardContent className="flex flex-col items-center justify-center h-full">
                      <p className="text-sm">Dom(TMT)</p>
                      <p className="text-2xl font-bold">{stockData.stock_transfers.dom.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className="h-32">
                    <CardContent className="flex flex-col items-center justify-center h-full">
                      <p className="text-sm">Non Dom(TMT)</p>
                      <p className="text-2xl font-bold">{stockData.stock_transfers.non_dom.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className="h-32">
                    <CardContent className="flex flex-col items-center justify-center h-full">
                      <p className="text-sm">Bulk(TMT)</p>
                      <p className="text-2xl font-bold">{stockData.stock_transfers.bulk.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-6 gap-4">
            <Card className="h-32">
              <CardContent className="flex flex-col items-center justify-center h-full">
                <p className="text-sm">In Transit(TMT)</p>
                <p className="text-2xl font-bold">{stockData.in_transit.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="h-32">
              <CardContent className="flex flex-col items-center justify-center h-full">
                <p className="text-sm">Days Cover(TMT)</p>
                <p className="text-2xl font-bold">{stockData.days_cover.toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}