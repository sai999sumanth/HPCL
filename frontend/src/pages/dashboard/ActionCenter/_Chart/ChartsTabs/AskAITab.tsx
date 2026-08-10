import React, { useCallback, useEffect, useState } from 'react';
import { Input } from '../../../../../@/components/ui/input';
import { Button } from '../../../../../@/components/ui/button';
import { Sparkles, Send, Save, RefreshCw, Home } from 'lucide-react';
import AI_Animation_5 from '../../../../../assets/gif/ai_animation_5.gif';
import { IconSquareX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../../@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../@/components/ui/select';
import { PlusCircle, XCircle } from 'lucide-react';
import { debounce } from 'lodash';
import ErrorMessageWithSuggestions from './ErrorComponents';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../../redux/store';
import BackButton from '../../../../../components/common/BackButton';
import { apiClient } from '@/services/apiClient';

interface AskAITabProps {
  dataset: string;
  chartType: string;
  chartData: any;
  selectedTheme: string;
  setChartData: (data: any) => void;
  isAskAITab?: boolean;
  onThemeChange: (theme: string) => void;
  onChartCreated: (chartData: any) => void;
}

const AskAITab: React.FC<AskAITabProps> = ({
  onChartCreated,
  dataset,
  chartData,
  selectedTheme,
  setChartData,
  isAskAITab = false,
}) => {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [chartName, setChartName] = useState('');
  const [selectedDashboard, setSelectedDashboard] = useState('');
  const [tagss, setTagss] = useState([{ name: '', value: '' }]);
  const [currentChartData, setCurrentChartData] = useState(null);
  const [showResetButton, setShowResetButton] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const navigate = useNavigate();
  const iconSize = 17;

  const [createdBy, setCreatedBy] = useState('Manual');
  const [chartType, setChartType] = useState('Manual');
  const [isHovering, setIsHovering] = useState(false);
  const [autoCompleteResults, setAutoCompleteResults] = useState([]);
  const [isErrorExpanded, setIsErrorExpanded] = useState(false);

  const chartDetails: any = useSelector((state: RootState) => state.chart);
  // console.log("chartDetails",chartDetails);
  let { name, group_name, tags } = chartDetails?.chart;

  // ...........debounce API call...........//
  const debouncedSearch = useCallback(
    debounce(async (searchText: string) => {
      if (searchText.trim().length === 0) {
        setAutoCompleteResults([]);
        return;
      }

      try {
        const response = await apiClient.post('/api/charts/get_auto_complete_text', {
          prompt: searchText
        });
        setAutoCompleteResults(response.data);
      } catch (error) {
        console.error('Error fetching autocomplete results:', error);
        setAutoCompleteResults([]);
      }
    }, 300), // 300ms delay
    []
  );

  useEffect(() => {
    // Fetch groups when component mounts
    const fetchGroups = async () => {
      try {
        const response = await apiClient.post('/api/charts/get_unique_values', {
          database: "hpcl_ceg",
          schema: "public",
          table: "charts",
          column: ["group_name"]
        });
        
        // Extract group names from the response and filter out null and empty values
        const groupNames = response.data.data.group_name.filter(
          (group: string | null) => group && group.trim() !== ''
        );
        setGroups(groupNames);
      } catch (error) {
        console.error('Error fetching groups:', error);
        setError('Failed to fetch groups');
      }
    };

    fetchGroups();
  }, []);

  useEffect(() => {
    setChartName(name);
  }, []);
  useEffect(() => {
    setSelectedDashboard(group_name);
  }, []);
 
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setUserInput(newValue);
    debouncedSearch(newValue);
  };

  // Cancel debounced calls on component unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleInputFocus = () => {
    setShowResetButton(true);
  };

  const handleInputBlur = () => {
    if (!isHovering) {
      setShowResetButton(false);
       // Hide autocomplete results after a short delay
       setTimeout(() => {
        setAutoCompleteResults([]);
      }, 200);
    }
  };

  const handleResetInput = () => {
    setUserInput('');
    setShowResetButton(false);
    setAutoCompleteResults([]);

  };

  const handleMouseEnter = () => {
    setIsHovering(true);
    setShowResetButton(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (!userInput) {
      setShowResetButton(false);
    }
  };
  const handleSuggestionClick = (suggestion: string) => {
    setUserInput(suggestion);
    setAutoCompleteResults([]);
  };

  const navigateToCharts = () => {
    navigate('/action-center/charts');
  };

  const generateChart = async () => {
    if (!userInput.trim()) {
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const generateQueryResponse = await apiClient.post('/api/charts/generate_dynamic_chart_query', {
        query_context: userInput
      });

      const [isValid, chartRequest] = generateQueryResponse.data;
      const modifiedChartRequest = {
        ...chartRequest,
        organization_id:6,
        params: {
          ...chartRequest.params,
          queries: chartRequest.params.queries.map(query => ({
            ...query,
            series_columns: [],
            row_limit: query.row_limit || 100
          }))
        }
      };
      console.log('modifiedChartRequest:', JSON.stringify(modifiedChartRequest, null, 2));

      const extendedChartRequest = {
        ...modifiedChartRequest,
        tagss: [{ name: "", value: "" }],
        type: "AIText",
        group_id: 0,
        group_name: selectedDashboard,
        user_query: "",
        user_ai_text: userInput,
        created_by: "AskAI",
        hashed_value: ""
      };
      const createChartResponse = await apiClient.post('/api/charts/chart', extendedChartRequest);
      console.log('Chart creation request:', JSON.stringify(extendedChartRequest, null, 2));

      const newChartData = {
        chartType: extendedChartRequest.visualization_name,
        chartData: createChartResponse.data.data,
        showLegend: true,
        legendType: 'scroll',
        chartRequest: extendedChartRequest,
        showLabelLines: true
      };

      setCurrentChartData(newChartData);
      setCreatedBy('AskAI');
      setChartType('AIText');
      onChartCreated(newChartData);
      setError(''); // Clear any existing error
    } catch (error) {
      console.error("Error generating chart:", error);
      setError('An error occurred while generating the chart. Please try again.');
      onChartCreated(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    setIsPopoverOpen(true);
  };

    const handleConfirmSave = async (shouldNavigate?: boolean) => {

    const chartToSave = currentChartData || chartData;
    
    if (!chartToSave) {
      console.error('No chart data to save');
      return;
    }

    // Check if the chart name already exists
    const response = await apiClient.post('/api/charts/get_unique_values', {
      database: "hpcl_ceg",
      schema: "public",
      table: "charts",
      column: ["name"]
    });
    const existingChartNames = response.data.data.name;

    // if (existingChartNames.includes(chartName)) {
    //   // Show an alert to the user
    //   alert(`Chart name "${chartName}" already exists. Please try another name.`);
    //   return;
    // }


    const requestBody = {
      ...(chartToSave.chartRequest || {}),
      name: chartName,
      dashboard: selectedDashboard,
      tagss: tagss.filter(tag => tag.name && tag.value),
      chartType: chartToSave.chartType,
      chartData: chartToSave.chartData,
      organization_id:6,
      createdBy: createdBy,
      type: chartType,
      group_id: 0,
      group_name: selectedDashboard, // Using the selected group name here
      user_query: chartType === 'AIText' ? userInput : "",
      user_ai_text: userInput,
      hashed_value: ""  
    };
  
    try {
      const response = await apiClient.post('/api/charts/save_charts', requestBody);
  
      if (!response.status) {
        throw new Error('Failed to save chart');
      }
  
      const result = response.data;
      console.log('Chart saved successfully:', result);
  
      setIsPopoverOpen(false);
      if (shouldNavigate) {
        navigate('/action-center/charts');
      }else{
        navigate(-1);

      }
    } catch (error) {
      console.error('Error saving chart:', error);
      setError('Failed to save the chart. Please try again.');
    }
  };

  const handleRestore = () => {
    setCurrentChartData(null);
    onChartCreated(null);
    setUserInput('');
  };

  const handleRefreshChart = async () => {
    // Only refresh if there's a user input to regenerate the chart
    if (userInput.trim() && (currentChartData || chartData)) {
      // Re-execute chart generation with the same user input
      await generateChart();
    }
  };

  const addTag = () => {
    setTagss([...tagss, { name: '', value: '' }]);
  };

  const removeTag = (index: number) => {
    setTagss(tagss.filter((_, i) => i !== index));
  };

  const updateTag = (index: number, field: 'name' | 'value', value: string) => {
    const updatedTags = tagss.map((tag, i) =>
      i === index ? { ...tag, [field]: value } : tag
    );
    setTagss(updatedTags);
  };
 // Clear error function - only clears the error when explicitly called
 const clearError = () => {
  setError('');
  setIsErrorExpanded(false);
};
 return (
    <div className="flex flex-col w-full items-center">
      <div className="flex w-full items-center">
        <img src={AI_Animation_5} alt="AI Animation" className="w-7 h-7 mr-1" />
        
        <div className="flex-grow flex items-center space-x-1 relative"
             onMouseEnter={handleMouseEnter}
             onMouseLeave={handleMouseLeave}>
          <Sparkles className="absolute left-3 z-10 text-gray-400" style={{ width: iconSize, height: iconSize }} />
          <Input
            className="pl-8 pr-10 py-1 w-full rounded-full bg-white-100 placeholder-gray-500 text-gray-700 focus:outline-none"
            style={{ height: '30px' }}
            placeholder="Ask Algo AI / Search..."
            value={userInput}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />
          {showResetButton && userInput && (
            <Button
              className="absolute right-8 bg-transparent text-gray-700 p-1 shadow-none rounded-full"
              onClick={handleResetInput}
            >
              <IconSquareX stroke={2} style={{ width: iconSize, height: iconSize, color: '#0047AB' }} />
            </Button>
          )}
          <Button
            className="absolute right-1 bg-transparent text-gray-700 p-1 shadow-none rounded-full"
            onClick={generateChart}
            disabled={isLoading}
          >
            <Send className="rotate-45 mr-2" style={{ width: iconSize, height: iconSize, color: '#67047A' }} />
          </Button>
          {autoCompleteResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
              {autoCompleteResults.map((suggestion, index) => (
                <div
                  key={index}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex space-x-1 ml-4">
        <BackButton   />
          <Button 
            className="p-1 rounded-lg bg-transparent hover:bg-gray-100 shadow-none"
            onClick={handleRefreshChart}
            disabled={!userInput.trim() || !(currentChartData || chartData)}
          >
            <RefreshCw style={{ width: iconSize, height: iconSize, color: '#0047AB' }} />
          </Button>

          <Button 
            className="p-1 rounded-lg bg-transparent hover:bg-gray-100 shadow-none"
            onClick={handleSave}
          >
            <Save style={{ width: iconSize, height: iconSize, color: '#0047AB' }} />
          </Button>

          <Button
            className="p-1 rounded-lg bg-transparent hover:bg-gray-100 shadow-none"
            onClick={navigateToCharts}
          >
            <Home style={{ width: iconSize, height: iconSize, color: '#0047AB' }} />
          </Button>
        </div>
      </div>

      {/* Replace the old error rendering with ErrorMessageWithSuggestions */}
      {error && (
        <div className="w-full mt-2">
          <ErrorMessageWithSuggestions />
        </div>
      )}

      {/* Dialog component remains the same */}
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
                  {groups.map((group, index) => (
                    <SelectItem key={index} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <label htmlFor="tags" className="font-medium text-sm">
                TAGS
              </label>
              {tagss.map((tag, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={tag.name}
                    placeholder="Name"
                    onChange={(e) => updateTag(index, 'name', e.target.value)}
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
            <div className="grid grid-cols-1 gap-2">
              <label htmlFor="createdBy" className="font-medium text-sm">
                CREATED BY
              </label>
              <Input
                id="createdBy"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                className="w-full"
                disabled
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsPopoverOpen(false)}>CANCEL</Button>
            <Button onClick={() => handleConfirmSave(false)} className="bg-[#0047AB] hover:bg-[#0047AB] text-white">Save &Go Back</Button>
            <Button onClick={() => handleConfirmSave(true)} className="bg-[#0047AB] hover:bg-[#0047AB] text-white">SAVE</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AskAITab;