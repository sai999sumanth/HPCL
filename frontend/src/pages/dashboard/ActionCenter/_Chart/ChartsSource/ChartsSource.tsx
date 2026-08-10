import React, { useState, useEffect } from 'react';
import { useDrag, useDragLayer } from 'react-dnd';
import axios from 'axios';
import { IconDotsVertical, IconGripVertical } from '@tabler/icons-react';
import { MdExpandMore, MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { TbAbc } from "react-icons/tb";
import { PiHashStraightBold } from "react-icons/pi";
import { MdAccessTime } from "react-icons/md";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../../@/components/ui/dropdown-menu";
import { Tooltip } from '@mui/material';
import { LuSearch } from "react-icons/lu";
import { Search } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../../redux/store';
import { apiClient } from '@/services/apiClient';

interface Item {
  id: string;
  name: string;
  type: string;
}

interface ChartSourceProps {
  dataset: string;
}

const ChartSource: React.FC<ChartSourceProps> = ({ dataset }) => {
  const [columns, setColumns] = useState<Item[]>([]);
  const [metrics, setMetrics] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMetricsOpen, setIsMetricsOpen] = useState(true);
  const [isColumnsOpen, setIsColumnsOpen] = useState(true);
  const [isChartSourceOpen, setIsChartSourceOpen] = useState(true);
  const [isEditingDataset, setIsEditingDataset] = useState(false);
  const [editedDataset, setEditedDataset] = useState(dataset);
  const chartDetails: any = useSelector((state: RootState) => state.chart);

  useEffect(() => {
    const fetchColumns = async () => {
      if (!dataset) return;

      const params = {
        database: '',
        schema: 'public',
        table: dataset
      };

      try {
        const response = await apiClient.post('/api/charts/get_columns', params);
        const fetchedColumns: Item[] = response.data.data.map((column: any) => ({
          id: column.name,
          name: column.name,
          type: column.type,
        }));
        setColumns(fetchedColumns);
      } catch (error) {
        console.error('Error fetching columns:', error);
        alert('Failed to fetch columns. Please check the console for more details.');
      }
    };

    fetchColumns();

    const hardcodedMetrics: Item[] = [
      { id: 'count_all', name: 'COUNT(*)', type: 'f(x)' },
    ];
    setMetrics(hardcodedMetrics);
  }, [dataset]);

  const filteredColumns = columns.filter((column) =>
    column.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMetrics = metrics.filter((metric) =>
    metric.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const CustomDragLayer = () => {
    const { isDragging, item, currentOffset } = useDragLayer((monitor) => ({
      item: monitor.getItem(),
      currentOffset: monitor.getSourceClientOffset(),
      isDragging: monitor.isDragging(),
    }));
  
    if (!isDragging || !currentOffset) {
      return null;
    }
  
    const transform = `translate(${currentOffset.x}px, ${currentOffset.y}px)`;
  
    return (
      <div style={{ position: 'fixed', pointerEvents: 'none', zIndex: 1000, transform }}>
        <div className="bg-white border rounded-lg shadow-lg p-2 text-sm">
          {item.name}
        </div>
      </div>
    );
  };
  
  const DraggableItem: React.FC<{ item: Item }> = ({ item }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
      type: item.type === 'f(x)' ? 'METRIC' : 'COLUMN',
      item: { id: item.id, name: item.name, type: item.type },
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }));
  
    const getColumnTypeIcon = (type: string) => {
      if (type.includes('character') || type === 'varchar') {
        return <TbAbc className="text-black-500" />;
      } else if (['numeric', 'jsonb', 'bigint','integer'].includes(type.toLowerCase())) {
        return <PiHashStraightBold className="text-black-500" />;
      } else if (type.toLowerCase().includes('timestamp')) {
        return <MdAccessTime className="text-black-500" />;
      }
      return null;
    };
  
    const icon = getColumnTypeIcon(item.type);
  
    if (isDragging) {
      return <div ref={drag} style={{ opacity: 0 }} />;
    }
  
    return (
      <li
        ref={drag}
        className="flex items-center p-2 border rounded-lg bg-white cursor-move hover:bg-gray-100"
        style={{ border: '1px solid #DFEBFF' }}
      >
        <Tooltip title={item.type} arrow>
          <span className="flex items-center mr-2">{icon}</span>
        </Tooltip>
        <span className="flex-grow text-sm truncate" title={item.name} style={{ color: '#545151' }}>
          {item.name}
        </span>
        <span className="ml-4">
          <IconGripVertical stroke={1.5} size={20} style={{ color: '#545151' }}/>
        </span>
      </li>
    );
  };
  

  const handleToggleMetrics = () => setIsMetricsOpen(!isMetricsOpen);
  const handleToggleColumns = () => setIsColumnsOpen(!isColumnsOpen);
  const handleToggleChartSource = () => setIsChartSourceOpen(!isChartSourceOpen);
  return (
    <div
      className={`relative flex h-full bg-white border-r border-gray-200 transition-all duration-300 ${
        isChartSourceOpen ? 'w-64' : 'w-10 cursor-pointer'
      }`}
      onClick={() => !isChartSourceOpen && handleToggleChartSource()}
    >
      {isChartSourceOpen && (
        <div className="flex flex-col h-full relative bg-white w-full">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold flex items-center justify-between mb-2"
              style={{ color: '#iii' }}
            >
              Chart Source
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={handleToggleChartSource}
                aria-label="Toggle Chart Source"
              >
                <MdChevronLeft className="text-2xl" />
              </button>
            </h2>

            <div className="flex items-center mb-2">
              <svg
                width="29"
                height="29"
                viewBox="0 0 29 29"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[#312D2D] mr-2 text-xl"
              >
                <path
                  d="M24.1673 11.2774V7.24967C24.1673 5.91499 23.0854 4.83301 21.7506 4.83301H17.7229M24.1673 11.2774H17.7229M24.1673 11.2774V17.7219M17.7229 4.83301V11.2774M17.7229 4.83301H11.2784M17.7229 11.2774H11.2784M17.7229 11.2774V17.7219M24.1673 17.7219V21.7497C24.1673 23.0844 23.0854 24.1663 21.7506 24.1663H17.7229M24.1673 17.7219H17.7229M4.83398 11.2774V7.24967C4.83398 5.91499 5.91596 4.83301 7.25065 4.83301H11.2784M4.83398 11.2774H11.2784M4.83398 11.2774V17.7219M11.2784 4.83301V11.2774M11.2784 11.2774V17.7219M4.83398 17.7219V21.7497C4.83398 23.0844 5.91596 24.1663 7.25065 24.1663H11.2784M4.83398 17.7219H11.2784M17.7229 17.7219H11.2784M17.7229 17.7219V24.1663M11.2784 17.7219V24.1663M17.7229 24.1663H11.2784"
                  stroke="#312D2D"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="p-2 rounded-lg bg-white text-[#312D2D] flex-grow" style={{ border: "1px solid #DFEBFF" }}>
                <span className="text-sm font-medium">{dataset || 'No dataset selected'}</span>
              </div>
              <button className="ml-2px text-black-500 hover:text-black-700">
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <IconDotsVertical stroke={1.5} size={20} className="text-black-600 mr-2 text-m" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>Edit</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </button>
            </div>

            <div className="mb-2">
      <div className="relative flex items-center mr-2 border border-gray-300 rounded-lg bg-[#F9F9F9]">
        <input
          type="text"
          placeholder="Search Metrics & Columns"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 pl-3 pr-10 text-sm bg-transparent focus:outline-none focus:ring-0"
          style={{ color: "#B9B9B9" }}
          aria-label="Search metrics and columns"
        />
        <Search className="absolute right-3 text-gray-400" size={18} />
      </div>
    </div>
              </div>

          
          <div className="flex-grow overflow-hidden">
            <div className="h-full overflow-y-auto pr-3">
              <div className="mb-4">
                <button
                  className="flex items-center text-lg font-semibold mb-2 w-full"
                  style={{ color: 'black' }}
                  onClick={handleToggleMetrics}
                >
                  Metrics
                  <span
                    className={`ml-auto ${
                      isMetricsOpen ? 'rotate-180' : 'rotate-0'
                    } transition-transform`}
                  >
                    <MdExpandMore />
                  </span>
                </button>
                {isMetricsOpen && (
                  <ul className="space-y-2">
                    {filteredMetrics.map((metric) => (
                      <DraggableItem key={metric.id} item={metric} />
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <button
                  className="flex items-center text-lg font-semibold mb-2 w-full"
                  onClick={handleToggleColumns}
                  style={{ color: 'black' }}
                >
                  Columns
                  <span
                    className={`ml-auto ${
                      isColumnsOpen ? 'rotate-180' : 'rotate-0'
                    } transition-transform`}
                  >
                    <MdExpandMore />
                  </span>
                </button>
                {isColumnsOpen && (
                  <ul className="space-y-2">
                    {filteredColumns.map((column) => (
                      <DraggableItem key={column.id} item={column} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {!isChartSourceOpen && (
        <div className="flex flex-col h-full w-full items-center">
          <button
            className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-700 focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleChartSource();
            }}
            aria-label="Expand Chart Source"
          >
            <MdChevronRight className="text-2xl mt-5" />
          </button>
        </div>
      )}
      <CustomDragLayer />
    </div>
  );
};

export default ChartSource;