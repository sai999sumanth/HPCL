// import React, { useEffect, useState } from 'react';
// import Pie from '../../Chart/ListOfCharts/Pie/Pie';
// import Bar from '../../Chart/ListOfCharts/Bar/Bar';
// import Line from '../../Chart/ListOfCharts/Line/Line';
// import BigNumber from '../../Chart/ListOfCharts/BigNumber/BigNumber';
// import Area from '../../Chart/ListOfCharts/Area/Area';
// import CustomTable from '../../Chart/ListOfCharts/Table/Table';
// import { useNavigate } from 'react-router-dom';
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../../@/components/ui/dialog';
// import { Input } from '../../../../../@/components/ui/input';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../@/components/ui/select';
// import { PlusCircle, XCircle } from 'lucide-react';
// import PivotTable from '../../Chart/ListOfCharts/PivotTable/PivotTable';
// import Donut from '../../Chart/ListOfCharts/Donut/Donut';
// import CustomBar from '../../Chart/ListOfCharts/CustomBar/CustomBar';
// import { IconDeviceFloppy, IconSettings, IconPencil } from '@tabler/icons-react';
// import { Popover, PopoverContent, PopoverTrigger } from "../../../../../@/components/ui/popover";
// import { Button } from "../../../../../@/components/ui/button";
// import { Label } from "../../../../../@/components/ui/label";
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../../../@/components/ui/tooltip";
// import ThemeDropdown from "../ChartsPreview/ThemeDropdown";
// import { LegendCheckbox, LegendOrientation, LegendType } from "../ChartsPreview/ChartCustomizationComponents";
// import { DataZoomCheckbox } from '../ChartsPreview/DataZoomCheckbox';
// import LabelLineCheckbox from "../../Chart/ListOfCharts/Pie/LabelLineCheckbox";
// import ExpressionEditor from '../ChartsTabs/ExpressionEditor';
// import Gauge from '../../Chart/ListOfCharts/Gauge/Gauge';
// // import AI_Animation_5 from '../../../../../assets/gif/ai_animation_5.gif';



// interface ChartPreviewProps {
//   dataset: string;
//   chartType: string;
//   chartData: any;
//   selectedTheme: string;
//   setChartData: (data: any) => void;
//   isAskAITab?: boolean;
//   onThemeChange: (theme: string) => void;
// }



// const ChartPreview: React.FC<ChartPreviewProps> = ({
//   dataset,
//   chartType,
//   chartData,
//   selectedTheme,
//   setChartData,
//   isAskAITab = false,
//   onThemeChange
// }) => {
//   const [localTheme, setLocalTheme] = useState(selectedTheme);
//   const [showLegend, setShowLegend] = useState(true);
//   const [legendOrientation, setLegendOrientation] = useState("top");
//   const [legendType, setLegendType] = useState("scroll");
//   const [showDataZoom, setShowDataZoom] = useState(false);
//   const [showLabelLines, setShowLabelLines] = useState(false);
//   const navigate = useNavigate();
//   const [isPopoverOpen, setIsPopoverOpen] = useState(false);
//   const [chartName, setChartName] = useState('');
//   const [selectedDashboard, setSelectedDashboard] = useState('');
//   const [tags, setTags] = useState([{ key: '', value: '' }]);
//   const [isExpressionEditorOpen, setIsExpressionEditorOpen] = useState(false);
//   const [createdBy, setCreatedBy] = useState('Manual');

//   useEffect(() => {
//     setCreatedBy(isAskAITab ? 'Ask AI' : 'Manual');
//   }, [isAskAITab]);

//   useEffect(() => {
//     setLocalTheme(selectedTheme);
//   }, [selectedTheme]);
//   const handleEditClick = () => {
//     setIsExpressionEditorOpen(true);
//   };
  
//   const handleExpressionEditorClose = () => {
//     setIsExpressionEditorOpen(false);
//   };
  
//   const handleExpressionEditorSave = () => {
//     // Handle saving the expressions
//     setIsExpressionEditorOpen(false);
//   };
  

//   const handleThemeChange = (newTheme: string) => {
//     setLocalTheme(newTheme);
//     onThemeChange(newTheme);
//   };

//   const handleShowLegendChange = (checked: boolean) => {
//     setShowLegend(checked);
//   };

//   const handleLegendOrientationChange = (value: string) => {
//     setLegendOrientation(value);
//   };

//   const handleLegendTypeChange = (value: string) => {
//     setLegendType(value);
//   };

//   const handleShowDataZoomChange = (checked: boolean) => {
//     setShowDataZoom(checked);
//   };

  
//   const handleSave = () => {
//     setIsPopoverOpen(true);
//   };

 
//   const handleConfirmSave = () => {
//     const chartRequest = chartData?.chartRequest;
//     console.log("API Request Body:", JSON.stringify(chartRequest, null, 2));

//     const savedCharts = JSON.parse(localStorage.getItem('savedCharts') || '[]');
//     savedCharts.push({
//       name: chartName,
//       visualization_name: chartRequest.visualization_name,
//       table: chartRequest.table,
//       dashboard: selectedDashboard,
//       tags: tags,
//       createdBy: createdBy // Add this line
//     });
//     localStorage.setItem('savedCharts', JSON.stringify(savedCharts));

//     setIsPopoverOpen(false);
//     navigate('/action-center/charts');
//   };
//   const handleCancel = () => {
//     setChartData(null);
//   };

//   const addTag = () => {
//     setTags([...tags, { key: '', value: '' }]);
//   };

//   const removeTag = (index: number) => {
//     setTags(tags.filter((_, i) => i !== index));
//   };

//   const updateTag = (index: number, field: 'key' | 'value', value: string) => {
//     const updatedTags = tags.map((tag, i) =>
//       i === index ? { ...tag, [field]: value } : tag
//     );
//     setTags(updatedTags);
//   };
 
//   const renderChart = () => {
//     if (!chartData) return null;

//     const commonProps = {
//       data: {
//         ...chartData,
//         showLegend,
//         legendOrientation,
//         legendType,
//         showDataZoom,
//         showLabelLines,
//       },
//       theme: localTheme
//     };
//     const chartTypeToRender = chartData.chartRequest?.visualization_name || chartType;

//     switch (chartTypeToRender.toLowerCase()) {
//       case 'pie':
//         return <Pie {...commonProps} />;
//       case 'donut':
//         return <Donut {...commonProps} />;
//       case 'bar':
//         return <Bar {...commonProps} />;
//       case 'custom_bar':
//         return <CustomBar {...commonProps} />;
//       case 'line':
//         return <Line {...commonProps} />;
//       case 'bignumber':
//         return <BigNumber data={chartData} />;
//       case 'area':
//         return <Area {...commonProps} />;
//       case 'gauge':
//         return <Gauge {...commonProps} />;
//       case 'table':
//         return <CustomTable {...commonProps} />;
//       case 'pivot_table':
//         return <PivotTable {...commonProps} />;
//       default:
//         return <div>Unsupported chart type: {chartTypeToRender}</div>;
//     }
//   };
  

//   const CustomizeContent = () => (
//     <div className="p-4 space-y-4">
//       <div>
//         <Label className="mb-2 block">Theme</Label>
//         <ThemeDropdown 
//           onThemeChange={handleThemeChange} 
//           selectedTheme={localTheme} 
//         />
//       </div>
//       <LegendCheckbox
//         showLegend={showLegend}
//         onShowLegendChange={handleShowLegendChange}
//       />
//       <LegendOrientation
//         orientation={legendOrientation}
//         onOrientationChange={handleLegendOrientationChange}
//       />
//       <LegendType
//         type={legendType}
//         onTypeChange={handleLegendTypeChange}
//       />
//       <DataZoomCheckbox
//         showDataZoom={showDataZoom}
//         onShowDataZoomChange={handleShowDataZoomChange}
//       />
//       <LabelLineCheckbox
//         label="Show Label Lines"
//         checked={showLabelLines}
//         onChange={setShowLabelLines}
//       />
//     </div>
//   );
//   return (
//     <div className="relative flex-1 bg-white p-2 overflow-y-auto">
//       <div className="flex items-center justify-end mb-4">
//         <TooltipProvider>
//           <Tooltip>
//             <TooltipTrigger asChild>
//               <Popover>
//                 <PopoverTrigger asChild>
//                 <Button variant="ghost" size="icon" className="p-2">
//                           <IconSettings size={24} style={{ color: '#0047AB' }} />
//                         </Button>
//                   {/* <Button className="rounded-lg pr-1 pl-1 pt-0 pb-0 border-2 bg-[#0047AB] hover:bg-[#0047AB]">
//                     <IconSettings className="h-5 w-5 text-blue" />
//                   </Button> */}
//                 </PopoverTrigger>
//                 <PopoverContent className="w-80 bg-white">
//                   <CustomizeContent />
//                 </PopoverContent>
//               </Popover>
//             </TooltipTrigger>
//             <TooltipContent>
//               <p>Customize</p>
//             </TooltipContent>
//           </Tooltip>
//         </TooltipProvider>
//         <TooltipProvider>
//           <Tooltip>
//             <TooltipTrigger asChild>
//               {/* <Button 
//                 className="rounded-lg pr-1 pl-1 pt-0 pb-0 border-2 bg-[#0047AB] hover:bg-[#0047AB] ml-2"
//                 onClick={handleEditClick}
//               >
//                 <IconPencil className="h-5 w-5 text-0047AB" />
//               </Button> */}
//               <Button variant="ghost" size="icon" onClick={handleEditClick} className="p-2 bg:'#0047AB'">
//       <IconPencil size={24} style={{ color: '#0047AB' }} />
//     </Button>
//             </TooltipTrigger>
//             <TooltipContent>
//               <p>Edit Expressions</p>
//             </TooltipContent>
//           </Tooltip>
//         </TooltipProvider>
//           {/* <button
//             onClick={handleSave}
//             className="bg-[#682a7a] hover:bg-[#562362] text-white px-2 py-1 text-xs rounded flex items-center mr-2"
//           >
//             <IconDeviceFloppy size={14} stroke={1.5} className="mr-1" />
//             Save
//           </button>
//           <button
//             onClick={handleCancel}
//             className="bg-gray-300 text-gray-700 px-2 py-1 text-xs rounded ml-2"
//           >
//             Cancel
//           </button> */}
//         </div>
      

//         <div className={`flex-1 bg-white p-4 overflow-y-auto ${isPopoverOpen ? 'blur-sm bg-white bg-opacity-80' : ''}`}>
//         {chartData ? (
//           renderChart()
//         ) : (
//           <div className="p-4 bg-white">
//             No chart data available. {isAskAITab ? "Please enter a query to generate a chart." : "Please create a chart first."}
//           </div>
//         )}
//       </div>

//       {!isAskAITab && (
//         <Dialog open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
//           <DialogContent className="sm:max-w-[500px] bg-white">
//             <DialogHeader>
//               <DialogTitle className="text-xl font-semibold">Save chart</DialogTitle>
//             </DialogHeader>
//             <div className="grid gap-4 py-4">
//               <div className="grid grid-cols-1 gap-2">
//                 <label htmlFor="name" className="font-medium text-sm">
//                   CHART NAME *
//                 </label>
//                 <Input
//                   id="name"
//                   value={chartName}
//                   onChange={(e) => setChartName(e.target.value)}
//                   className="w-full"
//                 />
//               </div>
//               <div className="grid grid-cols-1 gap-2">
//                 <label htmlFor="dashboard" className="font-medium text-sm">
//                   ADD TO GROUP
//                 </label>
//                 <Select
//                   value={selectedDashboard}
//                   onValueChange={setSelectedDashboard}
//                 >
//                   <SelectTrigger className="w-full">
//                     <SelectValue placeholder="Select a group" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="action-center">Action Center</SelectItem>
//                     <SelectItem value="aws">AWS</SelectItem>
//                     <SelectItem value="azure">Azure</SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>
  
//               <div className="grid grid-cols-1 gap-2">
//                 <label htmlFor="createdBy" className="font-medium text-sm">
//                   CREATED BY
//                 </label>
//                 <Input
//                   id="createdBy"
//                   value={createdBy}
//                   readOnly
//                   className="w-full bg-gray-100"
//                 />
//               </div>
//               <div className="grid grid-cols-1 gap-2">
//                 <label htmlFor="tags" className="font-medium text-sm">
//                   TAGS
//                 </label>
//                 {tags.map((tag, index) => (
//                   <div key={index} className="flex items-center gap-2">
//                     <Input
//                       value={tag.key}
//                       placeholder="Key"
//                       onChange={(e) => updateTag(index, 'key', e.target.value)}
//                       className="w-1/2"
//                     />
//                     <Input
//                       value={tag.value}
//                       placeholder="Value"
//                       onChange={(e) => updateTag(index, 'value', e.target.value)}
//                       className="w-1/2"
//                     />
//                     <Button
//                       variant="outline"
//                       size="icon"
//                       className="p-2"
//                       onClick={() => removeTag(index)}
//                     >
//                       <XCircle className="w-4 h-4 text-black-600" />
//                     </Button>
//                   </div>
                  
//                 ))}
//                 <Button onClick={addTag} className="mt-2 text-black flex items-center">
//                   <PlusCircle className="mr-1 w-4 h-4" /> Add tag
//                 </Button>
//               </div>
//             </div>
//               <div className="flex justify-end space-x-2 mt-4">
//               <Button variant="outline" onClick={() => setIsPopoverOpen(false)}>CANCEL</Button>
//               <Button onClick={handleConfirmSave} className="bg-[#0047AB] hover:bg-[#0047AB] text-white">SAVE</Button>
//             </div>
//           </DialogContent>
//         </Dialog>
//       )}
//         <ExpressionEditor
//         isOpen={isExpressionEditorOpen}
//         onClose={handleExpressionEditorClose}
//         onSave={handleExpressionEditorSave}
//         dataset={dataset}
//       />
   
//     </div>
//   );
// };

// export default ChartPreview;






import React, { useEffect, useState } from 'react';
import Pie from '../../Chart/ListOfCharts/Pie/Pie';
import Bar from '../../Chart/ListOfCharts/Bar/Bar';
import Line from '../../Chart/ListOfCharts/Line/Line';
import BigNumber from '../../Chart/ListOfCharts/BigNumber/BigNumber';
import Area from '../../Chart/ListOfCharts/Area/Area';
import CustomTable from '../../Chart/ListOfCharts/Table/Table';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../../@/components/ui/dialog';
import { Input } from '../../../../../@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../@/components/ui/select';
import { PlusCircle, XCircle } from 'lucide-react';
import PivotTable from '../../Chart/ListOfCharts/PivotTable/PivotTable';
import Donut from '../../Chart/ListOfCharts/Donut/Donut';
import CustomBar from '../../Chart/ListOfCharts/CustomBar/CustomBar';
import { IconDeviceFloppy, IconSettings, IconPencil } from '@tabler/icons-react';
import { Popover, PopoverContent, PopoverTrigger } from "../../../../../@/components/ui/popover";
import { Button } from "../../../../../@/components/ui/button";
import { Label } from "../../../../../@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../../../@/components/ui/tooltip";
import ThemeDropdown from "./ThemeDropdown";
import { LegendCheckbox, LegendOrientation, LegendType } from "./ChartCustomizationComponents";
import { DataZoomCheckbox } from './DataZoomCheckbox';
import LabelLineCheckbox from "../../Chart/ListOfCharts/Pie/LabelLineCheckbox";
import ExpressionEditor from '../ChartsTabs/ExpressionEditor';
import Gauge from '../../Chart/ListOfCharts/Gauge/Gauge';
import StackedBar from '../../Chart/ListOfCharts/StackedBarChart/StackedBarChart';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../../redux/store';
import TimeSeriesBar from '../../Chart/ListOfCharts/TImeSeries/TimeSeriesBar';
import TimeSeriesLine from '../../Chart/ListOfCharts/TImeSeries/TimeSeriesLine';
import CustomStackedBar from '../../Chart/ListOfCharts/CustomStackedBarChart/CustomStackedBarChart';
// import AI_Animation_5 from '../../../../../assets/gif/ai_animation_5.gif';



interface ChartPreviewProps {
  dataset: string;
  chartType: any;
  chartData: any;
  selectedTheme: string;
  setChartData: (data: any) => void;
  isAskAITab?: boolean;
  onThemeChange: (theme: string) => void;
}



const ChartPreview: React.FC<ChartPreviewProps> = ({
  dataset,
  chartType,
  chartData,
  selectedTheme,
  setChartData,
  isAskAITab = false,
  onThemeChange
}) => {
  const [localTheme, setLocalTheme] = useState(selectedTheme);
  const [showLegend, setShowLegend] = useState(true);
  const [legendOrientation, setLegendOrientation] = useState("top");
  const [legendType, setLegendType] = useState("scroll");
  const [showDataZoom, setShowDataZoom] = useState(false);
  const [showLabelLines, setShowLabelLines] = useState(false);
  const navigate = useNavigate();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [chartName, setChartName] = useState('');
  const [selectedDashboard, setSelectedDashboard] = useState('');
  const [tags, setTags] = useState([{ key: '', value: '' }]);
  const [isExpressionEditorOpen, setIsExpressionEditorOpen] = useState(false);
  const [createdBy, setCreatedBy] = useState('Manual');
  const chartDetails: any = useSelector((state: RootState) => state.chart);

  useEffect(() => {
    setCreatedBy(isAskAITab ? 'Ask AI' : 'Manual');
  }, [isAskAITab]);

  useEffect(() => {
    setLocalTheme(selectedTheme);
  }, [selectedTheme]);
  const handleEditClick = () => {
    setIsExpressionEditorOpen(true);
  };
  
  const handleExpressionEditorClose = () => {
    setIsExpressionEditorOpen(false);
  };
  
  const handleExpressionEditorSave = () => {
    // Handle saving the expressions
    setIsExpressionEditorOpen(false);
  };
  

  const handleThemeChange = (newTheme: string) => {
    setLocalTheme(newTheme);
    onThemeChange(newTheme);
  };

  const handleShowLegendChange = (checked: boolean) => {
    setShowLegend(checked);
  };

  const handleLegendOrientationChange = (value: string) => {
    setLegendOrientation(value);
  };

  const handleLegendTypeChange = (value: string) => {
    setLegendType(value);
  };

  const handleShowDataZoomChange = (checked: boolean) => {
    setShowDataZoom(checked);
  };

  
  const handleSave = () => {
    setIsPopoverOpen(true);
  };

 
  const handleConfirmSave = () => {
    const chartRequest = chartData?.chartRequest;
    console.log("API Request Body:", JSON.stringify(chartRequest, null, 2));

    const savedCharts = JSON.parse(localStorage.getItem('savedCharts') || '[]');
    savedCharts.push({
      name: chartName,
      visualization_name: chartRequest.visualization_name,
      table: chartRequest.table,
      dashboard: selectedDashboard,
      tags: tags,
      createdBy: createdBy // Add this line
    });
    localStorage.setItem('savedCharts', JSON.stringify(savedCharts));

    setIsPopoverOpen(false);
    navigate('/action-center/charts');
  };
  const handleCancel = () => {
    setChartData(null);
  };

  const addTag = () => {
    setTags([...tags, { key: '', value: '' }]);
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const updateTag = (index: number, field: 'key' | 'value', value: string) => {
    const updatedTags = tags.map((tag, i) =>
      i === index ? { ...tag, [field]: value } : tag
    );
    setTags(updatedTags);
  };
 

  const renderChart = () => {
    if (!chartData) return null;

    const commonProps = {
      data: {
        ...chartData,
        showLegend,
        legendOrientation,
        legendType,
        showDataZoom,
        showLabelLines,
      },
      theme: localTheme
    };

    // Safely determine the chart type with fallbacks
    const chartTypeToRender = (
      chartData?.chartRequest?.visualization_name || 
      chartType?.visualization_name || 
      ''
    ).toLowerCase();

    // Early return if no valid chart type
    if (!chartTypeToRender) {
      return <div>No chart type specified</div>;
    }

    switch (chartTypeToRender) {
      case 'pie':
        return <Pie {...commonProps} />;
      case 'donut':
        return <Donut {...commonProps} />;
      case 'bar':
        return <Bar {...commonProps} />;
      case 'stacked_bar':
        return <StackedBar {...commonProps} />;
      case 'custom_stacked_bar':
        return <CustomStackedBar {...commonProps} />;
      case 'custom_bar':
        return <CustomBar {...commonProps} />;
      case 'line':
        return <Line {...commonProps} />;
      case 'bignumber':
        return <BigNumber data={chartData} />;
      case 'area':
        return <Area {...commonProps} />;
      case 'gauge':
        return <Gauge {...commonProps} />;
      case 'table':
        return <CustomTable {...commonProps} />;
      case 'pivot_table':
        return <PivotTable {...commonProps} />;
      case 'time_series_bar':
        return <TimeSeriesBar {...commonProps} />;
      case 'time_series_line':
        return <TimeSeriesLine {...commonProps} />;
      default:
        return <div>Unsupported chart type: {chartTypeToRender}</div>;
    }
  };
  

  const CustomizeContent = () => (
    <div className="p-4 space-y-4">
      <div>
        <Label className="mb-2 block">Theme</Label>
        <ThemeDropdown 
          onThemeChange={handleThemeChange} 
          selectedTheme={localTheme} 
        />
      </div>
      <LegendCheckbox
        showLegend={showLegend}
        onShowLegendChange={handleShowLegendChange}
      />
      <LegendOrientation
        orientation={legendOrientation}
        onOrientationChange={handleLegendOrientationChange}
      />
      <LegendType
        type={legendType}
        onTypeChange={handleLegendTypeChange}
      />
      <DataZoomCheckbox
        showDataZoom={showDataZoom}
        onShowDataZoomChange={handleShowDataZoomChange}
      />
      <LabelLineCheckbox
        label="Show Label Lines"
        checked={showLabelLines}
        onChange={setShowLabelLines}
      />
    </div>
  );
  return (
    <div className="relative flex-1 bg-white p-2 overflow-y-auto">
      <div className="flex items-center justify-end mb-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Popover>
                <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="p-2">
                          <IconSettings size={24} style={{ color: '#0047AB' }} />
                        </Button>
                  {/* <Button className="rounded-lg pr-1 pl-1 pt-0 pb-0 border-2 bg-[#0047AB] hover:bg-[#0047AB]">
                    <IconSettings className="h-5 w-5 text-blue" />
                  </Button> */}
                </PopoverTrigger>
                <PopoverContent className="w-80 bg-white">
                  <CustomizeContent />
                </PopoverContent>
              </Popover>
            </TooltipTrigger>
            <TooltipContent>
              <p>Customize</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* <Button 
                className="rounded-lg pr-1 pl-1 pt-0 pb-0 border-2 bg-[#0047AB] hover:bg-[#0047AB] ml-2"
                onClick={handleEditClick}
              >
                <IconPencil className="h-5 w-5 text-0047AB" />
              </Button> */}
              <Button variant="ghost" size="icon" onClick={handleEditClick} className="p-2 bg:'#0047AB'">
                <IconPencil size={24} style={{ color: '#0047AB' }} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit Expressions</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
          {/* <button
            onClick={handleSave}
            className="bg-[#682a7a] hover:bg-[#562362] text-white px-2 py-1 text-xs rounded flex items-center mr-2"
          >
            <IconDeviceFloppy size={14} stroke={1.5} className="mr-1" />
            Save
          </button>
          <button
            onClick={handleCancel}
            className="bg-gray-300 text-gray-700 px-2 py-1 text-xs rounded ml-2"
          >
            Cancel
          </button> */}
        </div>
      

        <div className={`flex-1 bg-white p-4 overflow-y-auto ${isPopoverOpen ? 'blur-sm bg-white bg-opacity-80' : ''}`}>
        {chartData ? (
          renderChart()
        ) : (
          <div className="p-4 bg-white">
            No chart data available. {isAskAITab ? "Please enter a query to generate a chart." : "Please create a chart first."}
          </div>
        )}
      </div>

      {!isAskAITab && (
        <Dialog open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <DialogContent className="sm:max-w-[500px] bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Save chart</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 gap-2">
                <label htmlFor="name" className="font-medium text-sm">
                  CHART NAME *
                </label>
                <Input
                  id="name"
                  value={chartName}
                  onChange={(e) => setChartName(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <label htmlFor="dashboard" className="font-medium text-sm">
                  ADD TO GROUP
                </label>
                <Select
                  value={selectedDashboard}
                  onValueChange={setSelectedDashboard}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="action-center">Action Center</SelectItem>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
  
              <div className="grid grid-cols-1 gap-2">
                <label htmlFor="createdBy" className="font-medium text-sm">
                  CREATED BY
                </label>
                <Input
                  id="createdBy"
                  value={createdBy}
                  readOnly
                  className="w-full bg-gray-100"
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <label htmlFor="tags" className="font-medium text-sm">
                  TAGS
                </label>
                {tags.map((tag, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={tag.key}
                      placeholder="Key"
                      onChange={(e) => updateTag(index, 'key', e.target.value)}
                      className="w-1/2"
                    />
                    <Input
                      value={tag.value}
                      placeholder="Value"
                      onChange={(e) => updateTag(index, 'value', e.target.value)}
                      className="w-1/2"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="p-2"
                      onClick={() => removeTag(index)}
                    >
                      <XCircle className="w-4 h-4 text-black-600" />
                    </Button>
                  </div>
                  
                ))}
                <Button onClick={addTag} className="mt-2 text-black flex items-center">
                  <PlusCircle className="mr-1 w-4 h-4" /> Add tag
                </Button>
              </div>
            </div>
              <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setIsPopoverOpen(false)}>CANCEL</Button>
              <Button onClick={handleConfirmSave} className="bg-[#0047AB] hover:bg-[#0047AB] text-white">SAVE</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
        <ExpressionEditor
        isOpen={isExpressionEditorOpen}
        onClose={handleExpressionEditorClose}
        onSave={handleExpressionEditorSave}
        dataset={dataset}
      />
   
    </div>
  );
};

export default ChartPreview;




