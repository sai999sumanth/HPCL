import { getYesterdayDate } from '@/hooks/useYesterdayDate';
import { apiClient } from '@/services/apiClient';
import React, { useState, useEffect } from 'react';

const ExpandableRow = ({ data, zoneName, expanded, onToggle }) => {
  const npmuyData = data.filter(item => item.ZOName === zoneName && item.ConsumerType === 'NPMUY');
  const pmuyData = data.filter(item => item.ZOName === zoneName && item.ConsumerType === 'PMUY');

  const combineDataByCylType = (npmuyData, pmuyData) => {
    const combined = {};

    npmuyData.forEach(item => {
      if (!combined[item.CylType]) {
        combined[item.CylType] = {
          npmuy: { Total_Booking: 0, Total_Sales: 0, Total_Pending: 0 },
          pmuy: { Total_Booking: 0, Total_Sales: 0, Total_Pending: 0 },
        };
      }
      combined[item.CylType].npmuy.Total_Booking += item.Total_Booking;
      combined[item.CylType].npmuy.Total_Sales += item.Total_Sales;
      combined[item.CylType].npmuy.Total_Pending += item.Total_Pending;
    });

    pmuyData.forEach(item => {
      if (!combined[item.CylType]) {
        combined[item.CylType] = {
          npmuy: { Total_Booking: 0, Total_Sales: 0, Total_Pending: 0 },
          pmuy: { Total_Booking: 0, Total_Sales: 0, Total_Pending: 0 },
        };
      }
      combined[item.CylType].pmuy.Total_Booking += item.Total_Booking;
      combined[item.CylType].pmuy.Total_Sales += item.Total_Sales;
      combined[item.CylType].pmuy.Total_Pending += item.Total_Pending;
    });

    return combined;
  };

  const combinedData = combineDataByCylType(npmuyData, pmuyData);

  return (
    <>
      <tr className="border-y border-gray-300">
        <td className="p-2 border-x border-gray-300 bg-gray-50 text-xs">
          {(npmuyData.length > 0 || pmuyData.length > 0) && (
            <span className="cursor-pointer mr-2 inline-block w-4 text-gray-600 font-bold" onClick={onToggle}>
              {expanded ? '-' : '+'}
            </span>
          )}
          {zoneName}
        </td>
        {/* NPMUY values */}
        <td className="p-2 text-right border-r border-gray-300 text-xs">{npmuyData.reduce((sum, item) => sum + item.Total_Booking, 0)}</td>
        <td className="p-2 text-right border-r border-gray-300 text-xs">{npmuyData.reduce((sum, item) => sum + item.Total_Sales, 0)}</td>
        <td className="p-2 text-right border-r border-gray-300 text-xs">{npmuyData.reduce((sum, item) => sum + item.Total_Pending, 0)}</td>
        {/* PMUY values */}
        <td className="p-2 text-right border-r border-gray-300 text-xs">{pmuyData.reduce((sum, item) => sum + item.Total_Booking, 0)}</td>
        <td className="p-2 text-right border-r border-gray-300 text-xs">{pmuyData.reduce((sum, item) => sum + item.Total_Sales, 0)}</td>
        <td className="p-2 text-right border-r border-gray-300 text-xs">{pmuyData.reduce((sum, item) => sum + item.Total_Pending, 0)}</td>
      </tr>
      {expanded && (
        <>
          {Object.entries(combinedData).map(([cylType, values], index) => (
            <tr key={`combined-${index}`} className="border-y border-gray-300">
              <td className="p-2 pl-8 border-x border-gray-300 bg-white text-xs">{cylType}</td>
              {/* NPMUY values */}
              <td className="p-2 text-right border-r border-gray-300 text-xs">{(values as { npmuy: { Total_Booking: number } }).npmuy.Total_Booking}</td>
              <td className="p-2 text-right border-r border-gray-300 text-xs">{(values as { npmuy: { Total_Sales: number } }).npmuy.Total_Sales}</td>
              <td className="p-2 text-right border-r border-gray-300 text-xs">{(values as { npmuy: { Total_Pending: number } }).npmuy.Total_Pending}</td>
              {/* PMUY values */}
              <td className="p-2 text-right border-r border-gray-300 text-xs">{(values as { pmuy: { Total_Booking: number } }).pmuy.Total_Booking}</td>
              <td className="p-2 text-right border-r border-gray-300 text-xs">{(values as { pmuy: { Total_Sales: number } }).pmuy.Total_Sales}</td>
              <td className="p-2 text-right border-r border-gray-300 text-xs">{(values as { pmuy: { Total_Pending: number } }).pmuy.Total_Pending}</td>
            </tr>
          ))}
        </>
      )}
    </>
  );
};

const DomesticSalesTable = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.post('/api/charts/generate_vis_data', {
            filters: [],
            action: 'lpg_cdcms_domestic_sales_table',
            drill_state: ''
          });
        
        const result = response.data;
        if (result.status && result.data) {
          setData(result.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleRow = (rowId) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const zoneNames = [...new Set(data.map(item => item.ZOName))];

  if (loading) {
    return <div className="p-4 text-xs">Loading...</div>;
  }

  return (
    <div className="rounded-lg overflow-hidden">
      <div className="bg-blue-500 text-white p-2 text-center font-semibold text-xs">
        Domestic Sales Table ({getYesterdayDate()})
      </div>
      <div className="overflow-x-auto border border-gray-300">
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr>
              <th className="p-2 text-left border-x border-y border-gray-300 bg-gray-50 text-xs" rowSpan={2}>
                ConsumerType
              </th>
              <th className="p-2 text-center border-x border-y border-gray-300 bg-gray-50 text-xs" colSpan={3}>
                NPMUY
              </th>
              <th className="p-2 text-center border-x border-y border-gray-300 bg-gray-50 text-xs" colSpan={3}>
                PMUY
              </th>
            </tr>
            <tr className="bg-gray-50">
              <th className="p-2 text-right border-x border-y border-gray-300 text-xs">Total_Booking</th>
              <th className="p-2 text-right border-x border-y border-gray-300 text-xs">Total_Sales</th>
              <th className="p-2 text-right border-x border-y border-gray-300 text-xs">Total_Pending</th>
              <th className="p-2 text-right border-x border-y border-gray-300 text-xs">Total_Booking</th>
              <th className="p-2 text-right border-x border-y border-gray-300 text-xs">Total_Sales</th>
              <th className="p-2 text-right border-x border-y border-gray-300 text-xs">Total_Pending</th>
            </tr>
          </thead>
          <tbody>
            {zoneNames.map((zoneName, index) => (
              <ExpandableRow
                key={index}
                data={data}
                zoneName={zoneName}
                expanded={expandedRows.has(zoneName)}
                onToggle={() => toggleRow(zoneName)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DomesticSalesTable;