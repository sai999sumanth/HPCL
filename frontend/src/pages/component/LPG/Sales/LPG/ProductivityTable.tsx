import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ProcessedProductivityData, ProductivityTableRow, CarouselProductivityData, TotalProductivityData } from './Types';
import { Loader2, AlertTriangle, Clock, Package, Zap, BarChart3 } from 'lucide-react';

interface ProductivityTableProps {
  data: ProcessedProductivityData;
  loading: boolean;
  error: string | null;
}

const tableHeaders = [
  { label: 'Shift Type' },
  { label: 'Net Hours', icon: <Clock className="w-4 h-4 inline-block mr-2 text-gray-500" /> },
  { label: 'Total Production', icon: <Package className="w-4 h-4 inline-block mr-2 text-gray-500" /> },
  { label: 'Productivity (units/hr)', icon: <Zap className="w-4 h-4 inline-block mr-2 text-gray-500" /> },
];

const SkeletonRow: React.FC = () => (
  <tr className="border-b border-gray-200 bg-white">
    <td className="py-3 px-4"><div className="h-5 bg-gray-200 rounded animate-pulse w-3/4"></div></td>
    <td className="py-3 px-4 text-left"><div className="h-5 bg-gray-200 rounded animate-pulse w-1/2"></div></td>
    <td className="py-3 px-4 text-left"><div className="h-5 bg-gray-200 rounded animate-pulse w-1/2"></div></td>
    <td className="py-3 px-4 text-left"><div className="h-5 bg-gray-200 rounded animate-pulse w-1/2"></div></td>
  </tr>
);

const isCarouselId = (key: string) => /^\d+$/.test(key);

const META_LABELS = ['First Cylinder', 'Last Cylinder', 'Net Bottling Hours', 'Stoppage Hours'];

const MetaDataSkeletonStrip: React.FC = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 py-3 mb-2">
    {META_LABELS.map(label => (
      <div key={label}>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 mt-1"></div>
      </div>
    ))}
  </div>
);

const MetaDataStrip: React.FC<{ metaData: CarouselProductivityData | TotalProductivityData }> = ({ metaData }) => {
  const formatValue = (value: number | null | undefined) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 py-3 mb-2">
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">First Cylinder</p>
        <p className="text-sm font-medium text-gray-800">
          {metaData.first_cylinder
            ? new Date(metaData.first_cylinder).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : 'N/A'}
        </p>
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Last Cylinder</p>
        <p className="text-sm font-medium text-gray-800">
          {metaData.last_cylinder
            ? new Date(metaData.last_cylinder).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : 'N/A'}
        </p>
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Net Bottling Hours</p>
        <p className="text-sm font-medium text-gray-800">{formatValue(metaData.net_bottling_hours)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Stoppage Hours</p>
        <p className="text-sm font-medium text-gray-800">{formatValue(metaData.stoppage_hours)}</p>
      </div>
    </div>
  );
};

export const ProductivityTable: React.FC<ProductivityTableProps> = ({ data, loading, error }) => {
  const carouselIds = useMemo(
    () => Object.keys(data).filter(isCarouselId).sort((a, b) => Number(a) - Number(b)),
    [data]
  );
  const [activeTab, setActiveTab] = useState<string>('all');
  const effectiveActiveTab = carouselIds.length === 1 ? carouselIds[0] : activeTab;

  useEffect(() => {
    if (carouselIds.length === 0) {
      setActiveTab('all');
      return;
    }

    const isValidTab = activeTab === 'all'
      ? carouselIds.length > 1
      : carouselIds.includes(activeTab);

    if (!isValidTab) {
      setActiveTab(carouselIds.length === 1 ? carouselIds[0] : 'all');
    }
  }, [activeTab, carouselIds]);

  const formatValue = (value: number | null | undefined) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Build per-tab data including metaData so meta renders inside each tab
  const { tableData, title, metaData } = useMemo(() => {
    if (loading || error || carouselIds.length === 0) {
      return { tableData: [], title: 'Productivity Breakdown', metaData: null };
    }

    let displayData: ProductivityTableRow[];
    let displayTitle: string;
    let meta: CarouselProductivityData | TotalProductivityData | null = null;

    if (effectiveActiveTab === 'all') {
      displayTitle = 'Productivity Breakdown - All Carousels';
      meta = data.total || null;
      const aggregated = {
        Normal: { net_hours: 0, total_production: 0 },
        Overtime: { net_hours: 0, total_production: 0 },
        Break: { net_hours: 0, total_production: 0 },
      };

      carouselIds.forEach(id => {
        const carouselData = data[id] as CarouselProductivityData;
        if (carouselData.normal) {
          aggregated.Normal.net_hours += carouselData.normal.net_hours || 0;
          aggregated.Normal.total_production += carouselData.normal.total_production || 0;
        }
        if (carouselData.overtime) {
          aggregated.Overtime.net_hours += typeof carouselData.overtime.net_hours === 'number'
            ? carouselData.overtime.net_hours
            : Number(carouselData.overtime.net_hours) || 0;
          aggregated.Overtime.total_production += carouselData.overtime.total_production || 0;
        }
        if (carouselData.break) {
          aggregated.Break.net_hours += carouselData.break.net_hours || 0;
          aggregated.Break.total_production += carouselData.break.total_production || 0;
        }
      });

      displayData = (Object.keys(aggregated) as Array<keyof typeof aggregated>).map(shift => {
        const { net_hours, total_production } = aggregated[shift];
        const productivity = net_hours > 0 ? total_production / net_hours : 0;
        return { shift, net_hours, total_production, productivity };
      });
    } else {
      displayTitle = `Productivity Breakdown - Carousel ${effectiveActiveTab}`;
      const carouselData = data[effectiveActiveTab] as CarouselProductivityData;
      meta = carouselData;

      displayData = [];
      if (carouselData.normal) {
        displayData.push({
          shift: 'Normal',
          net_hours: carouselData.normal.net_hours || 0,
          total_production: carouselData.normal.total_production || 0,
          productivity: carouselData.normal.productivity || 0,
        });
      }
      if (carouselData.overtime) {
        displayData.push({
          shift: 'Overtime',
          net_hours: typeof carouselData.overtime.net_hours === 'number'
            ? carouselData.overtime.net_hours
            : Number(carouselData.overtime.net_hours) || 0,
          total_production: carouselData.overtime.total_production || 0,
          productivity: carouselData.overtime.productivity || 0,
        });
      }
      if (carouselData.break) {
        displayData.push({
          shift: 'Break',
          net_hours: carouselData.break.net_hours || 0,
          total_production: carouselData.break.total_production || 0,
          productivity: carouselData.break.productivity || 0,
        });
      }
    }

    return { tableData: displayData, title: displayTitle, metaData: meta };
  }, [data, loading, error, effectiveActiveTab, carouselIds]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col"
    >
      {/* Header + Tabs in one row */}
      <div className="flex items-center justify-between border-b border-gray-200 mb-3 pb-0">
        <h3 className="text-lg font-semibold text-gray-900 shrink-0 mr-6">{title}</h3>

        {carouselIds.length > 0 && (
          <div className="flex">
            {carouselIds.length > 1 && (
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  effectiveActiveTab === 'all'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All Carousels
              </button>
            )}
            {carouselIds.map(id => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  effectiveActiveTab === id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Carousel {id}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Meta data — skeleton while loading, real data after */}
      {loading ? (
        <MetaDataSkeletonStrip />
      ) : !error && metaData ? (
        <MetaDataStrip metaData={metaData} />
      ) : null}

      {/* Table — no flex-grow, so it hugs its content height */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {tableHeaders.map(header => (
                <th
                  key={header.label}
                  className="py-3 px-4 text-left font-medium text-gray-600 uppercase tracking-wider text-xs"
                >
                  {header.icon}
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
            ) : error || carouselIds.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">
                  {error || 'No productivity data for this period.'}
                </td>
              </tr>
            ) : (
              tableData.map(row => (
                <tr
                  key={row.shift}
                  className="transition-colors duration-200 hover:bg-gray-50"
                >
                  <td className="py-3 px-4 font-medium text-gray-800">{row.shift}</td>
                  <td className="py-3 px-4 text-left text-gray-700">{formatValue(row.net_hours)}</td>
                  <td className="py-3 px-4 text-left text-gray-700">{formatValue(row.total_production)}</td>
                  <td className="py-3 px-4 text-left text-gray-700">{formatValue(row.productivity)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};