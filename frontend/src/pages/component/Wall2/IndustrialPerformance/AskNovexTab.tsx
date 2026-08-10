import { useState, useEffect, useRef } from "react"; 
import { useNavigate } from "react-router-dom"; 
import { Button } from "@/@/components/ui/button"; 
import { Input } from "@/@/components/ui/input"; 
import { Sparkles, Send } from "lucide-react"; 
import { IconSquareX } from "@tabler/icons-react"; 
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import AI_Animation_5 from '../../../../assets/gif/ai_animation_5.gif';
import { apiClient } from "@/services/apiClient";

const AIInput = ({ icon, isLoading, setIsLoading }) => {
  const [userInput, setUserInput] = useState("");
  const [showResetButton, setShowResetButton] = useState(false);
  const [iconSize] = useState(20);
  const [responseData, setResponseData] = useState(null);
  const [error, setError] = useState(null);
  const [columnDefs, setColumnDefs] = useState([]);
  const [rowData, setRowData] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const gridRef = useRef();
  const inputRef = useRef();
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Process data for AG Grid when responseData changes
    if (responseData && responseData.length > 0) {
      // Generate column definitions based on the keys
      const cols = Object.keys(responseData[0]).map(key => ({
        headerName: key.replace(/_/g, ' ').toUpperCase(),
        field: key,
        sortable: true,
        filter: true,
        resizable: true,
        // Format numbers if needed
        valueFormatter: params => 
          typeof params.value === 'number' 
            ? params.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) 
            : params.value
      }));
      
      setColumnDefs(cols);
      setRowData(responseData);
    }
  }, [responseData]);

  // Debounce function for API calls
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  // Fetch autocomplete suggestions
  const fetchSuggestions = async (prompt) => {
    if (!prompt.trim() || prompt.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const response = await apiClient.post('/api/charts/get_auto_complete_text', {
          prompt: prompt
      });
      
      if (!response.status) {
        throw new Error(`Autocomplete API request failed with status ${response.status}`);
      }
      
      const data = await response.data;
      setSuggestions(data || []);
      setShowSuggestions(data && data.length > 0);
    } catch (err) {
      console.error("Error fetching suggestions:", err);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Debounced version of fetchSuggestions
  const debouncedFetchSuggestions = debounce(fetchSuggestions, 300);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setUserInput(value);
    setShowResetButton(value.length > 0);
    
    // Fetch suggestions as user types
    debouncedFetchSuggestions(value);
  };

  const handleSuggestionClick = (suggestion) => {
    setUserInput(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    setShowResetButton(true);
  };

  const handleResetInput = () => {
    setUserInput("");
    setShowResetButton(false);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleInputFocus = () => {
    setShowResetButton(userInput.length > 0);
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = (e) => {
    // Check if the blur is due to clicking on a suggestion
    if (suggestionsRef.current && suggestionsRef.current.contains(e.relatedTarget)) {
      return; // Don't hide suggestions if clicking on them
    }
    setTimeout(() => {
      setShowResetButton(false);
      setShowSuggestions(false);
    }, 200);
  };

  const generateIndustryPerformance = async () => {
    if (!userInput.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setShowSuggestions(false);
    
    try {
      const response = await apiClient.post('/api/industryperformance/generate_ai_industry_performance', {
          user_prompt: userInput
        });
      
      if (!response.status) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.data;
      setResponseData(data);
    } catch (err) {
      setError(err.message || "Failed to fetch data");
      console.error("Error fetching industry performance:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false);
      generateIndustryPerformance();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // AG Grid default configurations
  const defaultColDef = {
    flex: 1,
    minWidth: 100,
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center space-x-2 relative w-full mb-4">
        <img src={AI_Animation_5} alt="AI Animation" className="w-9 h-9" />
        <div className="flex-grow flex items-center space-x-1 relative"
          onMouseEnter={() => setShowResetButton(true)}
          onMouseLeave={() => setShowResetButton(false)}>
          <Sparkles className="absolute left-3 z-10 text-gray-400" style={{ width: iconSize, height: iconSize }} />
          <Input
            ref={inputRef}
            className="pl-8 pr-10 py-1 w-full rounded-full bg-white-100 placeholder-gray-500 text-gray-700 focus:outline-none"
            style={{ height: '30px' }}
            placeholder="Ask Novex AI / Search..."
            value={userInput}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
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
            onClick={generateIndustryPerformance}
            disabled={isLoading}
          >
            <Send className="rotate-45 mr-2" style={{ width: iconSize, height: iconSize, color: '#67047A' }} />
          </Button>

          {/* Autocomplete Suggestions Dropdown */}
          {showSuggestions && (
            <div 
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50 mt-1"
            >
              {isLoadingSuggestions ? (
                <div className="p-3 text-gray-500 text-sm">Loading suggestions...</div>
              ) : suggestions.length > 0 ? (
                suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="p-3 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseDown={(e) => e.preventDefault()} // Prevent input blur when clicking
                  >
                    {suggestion}
                  </div>
                ))
              ) : (
                <div className="p-3 text-gray-500 text-sm">No suggestions found</div>
              )}
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="w-full text-center py-4">
          <p>Loading data...</p>
        </div>
      )}

      {error && (
        <div className="w-full text-center py-4 text-red-500">
          <p>Error: {error}</p>
        </div>
      )}

      {responseData && responseData.length > 0 && (
        <div className="w-full mt-4 h-64"> {/* Set a fixed height for the grid */}
          <div className="ag-theme-alpine w-full h-full">
            <AgGridReact
              ref={gridRef}
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows={true}
              rowHeight={30} // Reduced row height
              headerHeight={40}
              pagination={true}
              paginationPageSize={10}
              suppressCellFocus={true}
              domLayout="autoHeight"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInput;