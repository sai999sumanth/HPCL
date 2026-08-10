import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/@/components/ui/dialog';
import { MessageCircle, Send, X, Loader2, MoreVertical, Eye } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { toast } from 'sonner';

interface VTSVehicleAIProps {
  className?: string;
}

interface Message {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: string;
  data?: any;
}

const VTSVehicleAI: React.FC<VTSVehicleAIProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  
  // Declare refs first before they're used
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Initialize counter to ensure unique IDs - will be incremented for each new message
  const messageIdCounterRef = useRef(0);
  
  // Load messages from localStorage on mount and ensure unique IDs
  const loadMessagesFromStorage = (): Message[] => {
    try {
      const stored = localStorage.getItem('vts_ai_chat_history');
      if (stored) {
        const loadedMessages: Message[] = JSON.parse(stored);
        // Ensure all messages have unique IDs by fixing any duplicates
        const seenIds = new Set<string>();
        const fixedMessages = loadedMessages.map((msg, index) => {
          if (seenIds.has(msg.id)) {
            // If ID is duplicate, create a new unique one
            const newId = `${msg.id}-${index}-${Date.now()}`;
            seenIds.add(newId);
            return { ...msg, id: newId };
          }
          seenIds.add(msg.id);
          return msg;
        });
        return fixedMessages;
      }
    } catch (error) {
      console.error('Error loading chat history from localStorage:', error);
    }
    return [];
  };

  const initialMessages = loadMessagesFromStorage();
  // Initialize counter based on loaded messages count to avoid ID conflicts
  if (messageIdCounterRef.current === 0 && initialMessages.length > 0) {
    messageIdCounterRef.current = initialMessages.length;
  }
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'welcome' | 'dateRange' | 'vehicleNumber' | 'result'>('welcome');
  const [showDataDialog, setShowDataDialog] = useState(false);
  const [selectedData, setSelectedData] = useState<any>(null);

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('vts_ai_chat_history', JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving chat history to localStorage:', error);
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add welcome message when panel opens (only if no messages exist)
      const welcomeMessage: Message = {
        id: '1',
        type: 'ai',
        content: "Hello there! 👋 I'm the AI Assistant, and I'm here to help you out. I can help you query vehicle information by date range and vehicle number.",
        timestamp: getCurrentTime()
      };
      setMessages([welcomeMessage]);
      setCurrentStep('welcome');
      
      // Add date range options message after a short delay
      setTimeout(() => {
        const dateOptionsMessage: Message = {
          id: '2',
          type: 'ai',
          content: 'Please select a date range:',
          timestamp: getCurrentTime(),
          data: { type: 'dateOptions' }
        };
        setMessages(prev => [...prev, dateOptionsMessage]);
      }, 800);
    }
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    // Don't clear messages - keep chat history
    setInputValue('');
  };

  const handleClose = () => {
    setIsOpen(false);
    // Don't clear messages - keep chat history when closing
    setInputValue('');
  };

  const addMessage = (type: 'ai' | 'user', content: string, data?: any) => {
    // Increment counter to ensure unique IDs even if messages are added in the same millisecond
    messageIdCounterRef.current += 1;
    const newMessage: Message = {
      id: `${Date.now()}-${messageIdCounterRef.current}`,
      type,
      content,
      timestamp: getCurrentTime(),
      data
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const getDateRange = (option: string): { start: string; end: string } => {
    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    switch (option) {
      case 'today':
        return { start: formatDate(today), end: formatDate(today) };
      case 'tomorrow':
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { start: formatDate(tomorrow), end: formatDate(tomorrow) };
      case '1week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { start: formatDate(weekAgo), end: formatDate(today) };
      case '15days':
        const days15 = new Date(today);
        days15.setDate(days15.getDate() - 15);
        return { start: formatDate(days15), end: formatDate(today) };
      case '1month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { start: formatDate(monthAgo), end: formatDate(today) };
      case '3months':
        const months3 = new Date(today);
        months3.setMonth(months3.getMonth() - 3);
        return { start: formatDate(months3), end: formatDate(today) };
      default:
        return { start: '', end: '' };
    }
  };

  const handleDateOptionSelect = (option: string) => {
    if (option === 'custom') {
      setCurrentStep('dateRange');
      addMessage('ai', 'Please select your custom date range using the date picker below.');
      return;
    }

    const { start, end } = getDateRange(option);
    setStartDate(start);
    setEndDate(end);
    
    const optionLabels: { [key: string]: string } = {
      'today': 'Today',
      'tomorrow': 'Tomorrow',
      '1week': '1 Week',
      '15days': '15 Days',
      '1month': '1 Month',
      '3months': '3 Months'
    };

    addMessage('user', `Selected: ${optionLabels[option]}`);
    setTimeout(() => {
      addMessage('ai', `Date range selected: ${start} to ${end}. Now please enter the vehicle number.`);
      setCurrentStep('vehicleNumber');
    }, 500);
  };

  const handleSend = async () => {
    if (!inputValue.trim() && currentStep !== 'dateRange' && currentStep !== 'vehicleNumber') {
      return;
    }

    // Add user message
    if (inputValue.trim()) {
      addMessage('user', inputValue.trim());
      setInputValue('');
    }

    // Handle different steps
    if (currentStep === 'welcome') {
      // Already showing date options, no need to do anything
      return;
    } else if (currentStep === 'dateRange') {
      // Try to parse dates from input or use date picker values
      if (startDate && endDate) {
        addMessage('ai', `Date range selected: ${startDate} to ${endDate}. Now please enter the vehicle number.`);
        setCurrentStep('vehicleNumber');
      } else {
        addMessage('ai', 'Please select both start and end dates using the date picker below.');
      }
    } else if (currentStep === 'vehicleNumber') {
      const vNumber = inputValue.trim() || vehicleNumber;
      if (vNumber) {
        setVehicleNumber(vNumber);
        setIsLoading(true);
        addMessage('ai', `Searching for vehicle ${vNumber}...`);

        try {
          const payload = {
            vehicle_number: vNumber,
            cross_filters: [
              {
                key: 'DATE',
                cond: 'equals',
                value: `${startDate},${endDate}`
              }
            ]
          };

          const response = await apiClient.post('/api/alerts/alerts_get_vts_query', payload);
          
          // Extract key fields from vehicle_details for the message
          const vehicleDetails = response.data?.vehicle_details || response.data?.data?.vehicle_details || {};
          const vehicleNumber = vehicleDetails.vehicle_number || vehicleDetails.vehicleNumber || vNumber || 'N/A';
          const zone = vehicleDetails.zone || 'N/A';
          const locationName = vehicleDetails.location_name || vehicleDetails.locationName || 'N/A';
          const transporterName = vehicleDetails.transporter_name || vehicleDetails.transporterName || 'N/A';
          
          // Store vehicle summary for display
          const vehicleSummary = {
            vehicleNumber,
            zone,
            locationName,
            transporterName
          };
          
          // Extract event_type_summary if available
          const eventTypeSummary = response.data?.event_type_summary || response.data?.data?.event_type_summary || null;
          const rowCount = response.data?.row_count || response.data?.data?.row_count || null;
          
          addMessage('ai', 'Vehicle details retrieved successfully!', { 
            type: 'vehicleData', 
            data: response.data,
            summary: vehicleSummary,
            eventTypeSummary: eventTypeSummary,
            rowCount: rowCount
          });
          setCurrentStep('result');
          toast.success('Query completed successfully');
          
          // After showing results, ask if they want to query another vehicle with Yes/No options
          setTimeout(() => {
            addMessage('ai', 'Would you like to know about another vehicle?', { type: 'yesNo' });
          }, 1000);
        } catch (error: any) {
          console.error('Error fetching vehicle data:', error);
          addMessage('ai', `Sorry, I couldn't fetch the data. ${error?.response?.data?.message || 'Please try again.'}`);
          setCurrentStep('vehicleNumber');
        } finally {
          setIsLoading(false);
          setInputValue('');
        }
      } else {
        addMessage('ai', 'Please enter a vehicle number.');
      }
    } else if (currentStep === 'result') {
      // This step is now handled by Yes/No buttons
      // Keep this for backward compatibility but it shouldn't be reached
    }
  };

  const handleDateSubmit = () => {
    if (startDate && endDate) {
      addMessage('user', `Date range: ${startDate} to ${endDate}`);
      setTimeout(() => {
        addMessage('ai', `Date range selected: ${startDate} to ${endDate}. Now please enter the vehicle number.`);
        setCurrentStep('vehicleNumber');
      }, 500);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }
        @keyframes icon-bounce {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
        .vts-ai-button {
          animation: float 3s ease-in-out infinite, pulse-ring 2s ease-in-out infinite;
        }
        .vts-ai-button:hover {
          animation: none;
          transform: translateY(-8px) scale(1.05);
        }
        .vts-ai-icon {
          animation: icon-bounce 2s ease-in-out infinite;
        }
        .vts-ai-button:hover .vts-ai-icon {
          animation: none;
          transform: scale(1.15);
        }
      `}</style>
      <Button
        onClick={handleOpen}
        className={`vts-ai-button fixed bottom-6 right-6 z-50 flex items-center justify-center text-sm sm:text-xs md:text-xs lg:text-xs xl:text-base text-white font-bold py-2 px-3 cursor-pointer rounded-full shadow-lg transform transition-transform duration-300 hover:scale-110 bg-gradient-to-l from-blue-400 via-violet-600 to-blue-800 group ${className}`}
        size="lg"
      >
        <MessageCircle className="vts-ai-icon w-5 h-5 group-hover:mr-2 transition-all duration-300" />
        <span className="hidden sm:inline opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-xs overflow-hidden whitespace-nowrap transition-all duration-300">Ask me about the vehicle</span>
        <span className="sm:hidden">AI</span>
      </Button>

      {/* Side Panel - Chat Interface */}
      <div
        className={`fixed bottom-6 right-0 h-[600px] w-full sm:w-[380px] bg-white shadow-2xl z-[60] transition-transform duration-300 ease-in-out flex flex-col rounded-tl-lg rounded-bl-lg ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Overlay for mobile */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-[59] sm:hidden"
            onClick={handleClose}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">AI Assistant</h2>
              <p className="text-xs text-gray-500">Powered by NOVEX</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <MoreVertical className="w-4 h-4 text-gray-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <X className="w-4 h-4 text-gray-600" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                        : 'bg-white text-gray-800 shadow-sm'
                    }`}
                  >
                    {message.data && message.data.type === 'vehicleData' && message.data.summary ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-700">{message.content}</p>
                        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-md p-2 border border-blue-100">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Vehicle Number:</span>
                              <span className="text-xs font-bold text-gray-900 break-words">{message.data.summary.vehicleNumber}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Zone:</span>
                              <span className="text-xs font-bold text-gray-900 break-words">{message.data.summary.zone}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Location Name:</span>
                              <span className="text-xs font-bold text-gray-900 break-words">{message.data.summary.locationName}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Transporter Name:</span>
                              <span className="text-xs font-bold text-gray-900 break-words">{message.data.summary.transporterName}</span>
                            </div>
                          </div>
                        </div>
                        {message.data.eventTypeSummary && Array.isArray(message.data.eventTypeSummary) && message.data.eventTypeSummary.length > 0 && (
                          <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-md p-2 border border-green-100">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Event Type Summary</p>
                              {message.data.rowCount !== null && message.data.rowCount !== undefined && (
                                <span className="text-xs font-bold text-gray-900 bg-green-100 px-2 py-0.5 rounded">
                                  Total: {message.data.rowCount}
                                </span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {message.data.eventTypeSummary.map((event: any, index: number) => {
                                const eventType = event['Event Type'] || event.eventType || event.event_type || 'N/A';
                                return (
                                  <div key={`${eventType}-${index}-${message.id || index}`} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="font-medium text-gray-700 break-words">
                                      {eventType}:
                                  </span>
                                  <span className="font-bold text-gray-900">{event.count || 0}</span>
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                    {message.data && message.data.type === 'dateOptions' && (
                      <div className="mt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: 'today', label: 'Today' },
                            { key: 'tomorrow', label: 'Tomorrow' },
                            { key: '1week', label: '1 Week' },
                            { key: '15days', label: '15 Days' },
                            { key: '1month', label: '1 Month' },
                            { key: '3months', label: '3 Months' }
                          ].map((option) => (
                            <Button
                              key={option.key}
                              onClick={() => handleDateOptionSelect(option.key)}
                              className="h-9 text-xs bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                        <Button
                          onClick={() => handleDateOptionSelect('custom')}
                          variant="outline"
                          className="w-full h-9 text-xs border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
                        >
                          Select Custom Date Range
                        </Button>
                      </div>
                    )}
                    {message.data && message.data.type === 'vehicleData' && (
                      <div className="mt-3">
                        <Button
                          onClick={() => {
                            setSelectedData(message.data.data);
                            setShowDataDialog(true);
                          }}
                          className="w-full h-9 text-xs bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Full Data
                        </Button>
                      </div>
                    )}
                    {message.data && message.data.type === 'yesNo' && (
                      <div className="mt-3 space-y-2">
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              addMessage('user', 'Yes');
                              // Reset dates and vehicle number for new query
                              setStartDate('');
                              setEndDate('');
                              setVehicleNumber('');
                              // Show date options
                              setTimeout(() => {
                                addMessage('ai', 'Please select a date range:', { type: 'dateOptions' });
                                setCurrentStep('welcome');
                              }, 300);
                            }}
                            className="flex-1 h-9 text-xs bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
                          >
                            Yes
                          </Button>
                          <Button
                            onClick={() => {
                              addMessage('user', 'No');
                              setTimeout(() => {
                                addMessage('ai', 'Thank you! Feel free to ask me anytime. 👋');
                              }, 300);
                              // Close the panel after a short delay
                              setTimeout(() => {
                                handleClose();
                              }, 1500);
                            }}
                            className="flex-1 h-9 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700"
                          >
                            No
                          </Button>
                        </div>
                      </div>
                    )}
                    {message.data && message.data.type !== 'dateOptions' && message.data.type !== 'vehicleData' && message.data.type !== 'yesNo' && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(message.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  <p className={`text-xs text-gray-500 mt-1 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                    {message.timestamp}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Date Range Picker (shown when in dateRange step) */}
        {currentStep === 'dateRange' && (
          <div className="px-4 py-2 border-t border-gray-200 bg-white">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-9 text-sm"
                  max={endDate || undefined}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-9 text-sm"
                  min={startDate || undefined}
                />
              </div>
            </div>
            <Button
              onClick={handleDateSubmit}
              disabled={!startDate || !endDate}
              className="w-full h-8 text-sm bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
            >
              Submit Date Range
            </Button>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type here"
              className="flex-1 h-10 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || (!inputValue.trim() && currentStep !== 'dateRange')}
              className="h-10 w-10 p-0 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg"
            >
              <Send className="w-4 h-4 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* Data Dialog */}
      <style>{`
        [data-radix-dialog-overlay] {
          z-index: 80 !important;
        }
        [data-radix-dialog-content] {
          z-index: 80 !important;
        }
      `}</style>
      <Dialog open={showDataDialog} onOpenChange={setShowDataDialog}>
        <DialogContent className="sm:max-w-[95vw] lg:max-w-[1200px] max-h-[90vh] overflow-y-auto z-[80]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Eye className="w-5 h-5 text-blue-500" />
              Vehicle Data Details
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {selectedData && selectedData.data && (
              <div className="space-y-2">
                {/* Vehicle Details at the top */}
                {selectedData.data.vehicle_details && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Vehicle Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(selectedData.data.vehicle_details)
                        .filter(([key]) => {
                          const lowerKey = key.toLowerCase();
                          return !['vehicle_number', 'vehiclenumber', 'zone', 'location_name', 'locationname', 'transporter_name', 'transportername'].includes(lowerKey);
                        })
                        .map(([key, value]) => {
                        let displayValue = '';
                        if (Array.isArray(value)) {
                          displayValue = value.map(item => String(item).replace(/_/g, ' ')).join(', ');
                        } else if (typeof value === 'object' && value !== null) {
                          displayValue = JSON.stringify(value).replace(/_/g, ' ');
                        } else {
                          displayValue = String(value).replace(/_/g, ' ');
                        }
                        return (
                          <div key={key} className="min-w-0">
                            <p className="text-xs font-medium text-gray-600 mb-1">
                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                            <p className="text-sm font-semibold text-gray-900 break-words" title={displayValue}>
                              {displayValue}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Vehicle Data in table */}
                {selectedData.data.vehicle_data && Array.isArray(selectedData.data.vehicle_data) && selectedData.data.vehicle_data.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <h3 className="text-sm font-semibold text-gray-800 mb-1 px-2 pt-2">Vehicle Data</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-blue-500 to-indigo-500">
                          <tr>
                            {Object.keys(selectedData.data.vehicle_data[0]).map((key) => (
                              <th key={key} className="px-2 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedData.data.vehicle_data.map((row: any, index: number) => {
                            // Function to check if row contains navigation keywords
                            const handleRowClick = () => {
                              // Convert row data to string for searching
                              const rowString = JSON.stringify(row).toLowerCase();
                              
                              // Check for Event Type in the row data
                              const eventType = row['Event Type'] || row.eventType || row.event_type || '';
                              const eventTypeLower = String(eventType).toLowerCase();
                              
                              // Check for Trip pending closure (2+ hrs) - navigate to Ongoing Trips Dashboard and click card
                              if (eventTypeLower.includes('trip pending closure') || 
                                  eventTypeLower.includes('trip pending closure (2+ hrs)') ||
                                  eventTypeLower.includes('trip_pending_closure') ||
                                  rowString.includes('trip pending closure')) {
                                navigate('/governance/vts/live?card=tripPendingClosure');
                                setShowDataDialog(false);
                                return;
                              }
                              
                              // Check for route_deviation_count - navigate to Compliance Dashboard and click Route Violation card
                              if (eventTypeLower.includes('route_deviation') || 
                                  eventTypeLower.includes('route deviation') ||
                                  eventTypeLower.includes('route violation') ||
                                  rowString.includes('route_deviation_count')) {
                                navigate('/governance/vts/compliance?card=routeViolation');
                                setShowDataDialog(false);
                                return;
                              }
                              
                              // Check for stoppage_violations_count - navigate to Compliance Dashboard and click Unauthorised Stoppage card
                              if (eventTypeLower.includes('stoppage_violation') || 
                                  eventTypeLower.includes('stoppage violation') ||
                                  eventTypeLower.includes('unauthorised stoppage') ||
                                  rowString.includes('stoppage_violations_count')) {
                                navigate('/governance/vts/compliance?card=unauthorisedStoppage');
                                setShowDataDialog(false);
                                return;
                              }
                              
                              // Check for VTS Live / Ongoing Trips keywords
                              if (rowString.includes('vts live') || 
                                  rowString.includes('ongoing trips') || 
                                  rowString.includes('ongoing_trips') ||
                                  rowString.includes('live')) {
                                navigate('/governance/vts/live');
                                setShowDataDialog(false);
                                return;
                              }
                              
                              // Check for Compliance keywords (general)
                              if (rowString.includes('compliance')) {
                                navigate('/governance/vts/compliance');
                                setShowDataDialog(false);
                                return;
                              }
                            };

                            // Create a unique key from row data or use index with message id
                            const rowKey = row.id || row.timestamp || row.created_at || `${selectedData.id || 'data'}-${index}`;
                            return (
                              <tr 
                                key={rowKey} 
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={handleRowClick}
                              >
                                {Object.entries(row).map(([key, value]) => {
                                  let displayValue = '';
                                  if (Array.isArray(value)) {
                                    displayValue = value.map(item => String(item).replace(/_/g, ' ')).join(', ');
                                  } else if (typeof value === 'object' && value !== null) {
                                    displayValue = JSON.stringify(value, null, 2).replace(/_/g, ' ');
                                  } else {
                                    displayValue = String(value).replace(/_/g, ' ');
                                  }
                                  return (
                                    <td key={key} className="px-2 py-1.5 text-sm text-gray-700">
                                      <div className="break-words" title={displayValue}>
                                        {displayValue}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {selectedData.data.vehicle_data && !Array.isArray(selectedData.data.vehicle_data) && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <h3 className="text-sm font-semibold text-gray-800 mb-1 px-2 pt-2">Vehicle Data</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-blue-500 to-indigo-500">
                          <tr>
                            <th className="px-2 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wider">
                              Field
                            </th>
                            <th className="px-2 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wider">
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.entries(selectedData.data.vehicle_data).map(([key, value]) => (
                            <tr key={key} className="hover:bg-gray-50">
                              <td className="px-2 py-1.5 text-sm font-medium text-gray-900 capitalize whitespace-nowrap">
                                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </td>
                              <td className="px-2 py-1.5 text-sm text-gray-700">
                                {typeof value === 'object' && value !== null && !Array.isArray(value) ? (
                                  <div className="space-y-1">
                                    {Object.entries(value as Record<string, any>).map(([nestedKey, nestedValue]) => {
                                      let nestedDisplayValue = '';
                                      if (Array.isArray(nestedValue)) {
                                        nestedDisplayValue = nestedValue.map(item => String(item).replace(/_/g, ' ')).join(', ');
                                      } else if (typeof nestedValue === 'object' && nestedValue !== null) {
                                        nestedDisplayValue = JSON.stringify(nestedValue, null, 2).replace(/_/g, ' ');
                                      } else {
                                        nestedDisplayValue = String(nestedValue).replace(/_/g, ' ');
                                      }
                                      return (
                                        <div key={nestedKey} className="flex items-start gap-2">
                                          <span className="font-medium text-gray-600 min-w-[100px] text-sm">
                                            {nestedKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                                          </span>
                                          <span className="text-gray-800 text-sm break-words">
                                            {nestedDisplayValue}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : Array.isArray(value) ? (
                                  <span className="break-words">{value.map(item => String(item).replace(/_/g, ' ')).join(', ')}</span>
                                ) : (
                                  <span className="break-words">{String(value).replace(/_/g, ' ')}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
            {selectedData && !selectedData.data && (
              <div className="text-center py-8 text-gray-500">
                No data available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VTSVehicleAI;
