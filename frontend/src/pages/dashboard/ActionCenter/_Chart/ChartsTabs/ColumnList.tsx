import React, { useState, useEffect } from 'react';
import { Input } from "../../../../../@/components/ui/input";
import { Search, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Checkbox } from "../../../../../@/components/ui/checkbox";
import { Button } from "../../../../../@/components/ui/button";
import { apiClient } from '@/services/apiClient';

interface Column {
  name: string;
  type: string;
  checked: boolean;
}

interface ColumnListProps {
  dataset: string;
  onAddColumn: (columnName: string, columnType: string) => void;
}

const ColumnList: React.FC<ColumnListProps> = ({ dataset, onAddColumn }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    metrics: true,
    dimensions: true,
    filters: true,
  });
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);

  useEffect(() => {
    const fetchColumns = async () => {
      if (!dataset) return;

      try {
        const response = await apiClient.post('/api/charts/get_columns', {
          database: 'hpcl_ceg',
          schema: 'public',
          table: dataset,
        });
        setColumns(response.data.data.map((column: any) => ({
          name: column.name,
          type: column.type,
          checked: false,
        })));
      } catch (error) {
        console.error('Error fetching columns:', error);
        setColumns([]);
      } finally {
        setLoading(false);
      }
    };

    fetchColumns();
  }, [dataset]);

  const filteredColumns = columns.filter(col =>
    col.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleColumnCheck = (index: number) => {
    setColumns(prev => prev.map((col, i) => 
      i === index ? { ...col, checked: !col.checked } : col
    ));
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const renderColumnItem = (column: Column, index: number) => (
    <div
      key={column.name}
      className="flex items-center py-2 px-4 hover:bg-gray-100 relative"
      onMouseEnter={() => setHoveredColumn(column.name)}
      onMouseLeave={() => setHoveredColumn(null)}
    >
      <Checkbox
        checked={column.checked}
        onCheckedChange={() => toggleColumnCheck(index)}
        className="mr-3 h-4 w-4 rounded-sm border-gray-300"
      />
      <span className="text-sm font-medium text-gray-700">{column.name}</span>
      <span className="ml-auto text-xs text-gray-500">{column.type}</span>
      {hoveredColumn === column.name && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 bg-white rounded-full shadow-lg px-2 py-1 text-xs"
          onClick={() => onAddColumn(column.name, column.type)}
        >
          <Plus className="h-3 w-3 mr-1" />
           Add Column
        </Button>
      )}
    </div>
  );

  const renderSection = (title: string, key: keyof typeof expandedSections) => (
    <div className="border-b border-gray-200 last:border-b-0">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => toggleSection(key)}
      >
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        <div className="flex items-center">
          <span className="text-xs text-gray-500 mr-2">{filteredColumns.length} Columns</span>
          {expandedSections[key] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </div>
      {expandedSections[key] && (
        <div className="max-h-64 overflow-y-auto">
          {filteredColumns.map(renderColumnItem)}
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div className="p-4">Loading columns...</div>;
  }

  return (
    <div className="flex flex-col h-full border-r border-gray-200 bg-white">
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search columns"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-sm"
          />
          <Search className="absolute left-2 top-2 h-4 w-4 text-gray-400" />
        </div>
      </div>

      {renderSection("METRICS", "metrics")}
      {renderSection("DIMENSIONS", "dimensions")}
      {renderSection("FILTERS", "filters")}
    </div>
  );
};

export default ColumnList;