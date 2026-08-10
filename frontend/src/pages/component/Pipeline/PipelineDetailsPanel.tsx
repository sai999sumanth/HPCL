import React, { useState } from 'react';
import { ExternalLink, MapPin, FileText, Droplet, Gauge, ArrowUp, Download, Maximize2, X } from 'lucide-react';
import dispatchImage from '@/assets/images/dispatch-terminal.svg';
import intermediatePumpingImage from '@/assets/images/intermediate-pumping.png';
import receivingTerminalImage from '@/assets/images/latch_7426516.png';

interface Location {
  location_code: string;
  location_name: string;
  location_type: 'DISPATCH_TERMINAL' | 'INTERMEDIATE_PUMPING' | 'RECEIVING_TERMINAL';
  state: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

interface Pipeline {
  name: string;
  description: string;
  pipeline_color?: string;
  pipeline_type: string;
  total_length_km: number;
  capacity: {
    value: number;
    unit: string;
  };
  products: string[];
  states_spanned: string[];
  phases: any[];
  locations: Location[];
  sv_stations: {
    count: number;
    avg_spacing_km: number;
  };
  line_fill_quantity_kl?: number;
  pipe_size_inch?: string;
  url: string;
}

interface SelectedLocation {
  location: Location;
  pipeline: Pipeline;
}

interface PipelineDetailsPanelProps {
  selectedLocation: SelectedLocation | null;
  onLaunchSCADA: () => void;
}

const PipelineDetailsPanel: React.FC<PipelineDetailsPanelProps> = ({ selectedLocation, onLaunchSCADA }) => {
  const [isSchematicExpanded, setIsSchematicExpanded] = useState(false);

  if (!selectedLocation) {
    return (
      <div className="w-[269px] h-full flex flex-col bg-white border-l border-gray-200">
        <div className="p-2">
          <p className="text-center text-[10px] text-gray-500">
            Click on a location marker to view technical details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[269px] h-full flex flex-col bg-white border-l border-gray-200">
      <div className="text-gray-900 flex flex-col h-full">
        {/* Sticky Header Section */}
        <div className="flex-shrink-0">
          {/* Header */}
          <div className="flex items-center justify-center p-2 border-b border-gray-200 bg-white">
            <h1 className="text-xs font-semibold text-gray-900">Pipeline Details</h1>
          </div>

          {/* Pipeline Overview */}
          <div className="p-2 border-b border-gray-200 bg-white">
            <div className="flex items-start gap-2 mb-2">
              {/* Image Thumbnail Placeholder */}
              <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                <FileText className="h-6 w-6 text-gray-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="px-1.5 py-0.5 bg-green-600 text-white text-[10px] font-medium rounded">
                    ACTIVE
                  </span>
                </div>
                <h2 className="text-xs font-bold text-gray-900 mb-0.5">
                  {selectedLocation.pipeline.description || selectedLocation.pipeline.name}
                </h2>
                <p className="text-[10px] text-gray-600 mb-1">
                  {selectedLocation.pipeline.name}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-gray-600">
                  <MapPin className="h-2.5 w-2.5" />
                  <span>{selectedLocation.pipeline.states_spanned?.join(', ') || selectedLocation.location.state}, India</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="p-2 border-b border-gray-200 grid grid-cols-3 gap-2 bg-white">
            {/* LENGTH Card */}
            <div className="bg-gray-50 rounded p-2 border border-gray-200">
              <p className="text-[10px] text-gray-500 mb-0.5">LENGTH</p>
              <p className="text-sm font-bold text-orange-500 mb-0.5">
                {selectedLocation.pipeline.total_length_km?.toFixed(2) || '0.00'}
              </p>
              <p className="text-[10px] text-gray-500">Kilometers</p>
            </div>

            {/* CAPACITY Card */}
            <div className="bg-gray-50 rounded p-2 border border-gray-200">
              <p className="text-[10px] text-gray-500 mb-0.5">CAPACITY</p>
              <p className="text-sm font-bold text-orange-500 mb-0.5">
                {selectedLocation.pipeline.capacity?.value || '0'}
              </p>
              <p className="text-[10px] text-gray-500">{selectedLocation.pipeline.capacity?.unit || 'MMTPA'}</p>
            </div>

            {/* PIPE SIZE Card */}
            <div className="bg-gray-50 rounded p-2 border border-gray-200">
              <p className="text-[10px] text-gray-500 mb-0.5">PIPE SIZE</p>
              <p className="text-sm font-bold text-orange-500 mb-0.5">
                {selectedLocation.pipeline.pipe_size_inch?.split('&')[0]?.trim() || selectedLocation.pipeline.pipe_size_inch || '0"'}
              </p>
              <p className="text-[10px] text-gray-500">Carbon Steel</p>
            </div>
          </div>
        </div>

        {/* Scrollable Middle Section */}
        <div className="flex-1 overflow-y-auto">
          {/* Pipeline Schematic */}
          <div className="p-1.5 border-b border-gray-200">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[10px] font-semibold text-gray-900">Pipeline Schematic</h3>
              <button
                onClick={() => setIsSchematicExpanded(true)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Expand schematic view"
              >
                <Maximize2 className="h-3 w-3 text-gray-600" />
              </button>
            </div>
            
            {/* Schematic Visualization */}
            <div 
              className="relative overflow-x-auto" 
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#9CA3AF #E5E7EB'
              }}
            >
              <style>{`
                .pipeline-schematic-scroll::-webkit-scrollbar {
                  height: 3px;
                }
                .pipeline-schematic-scroll::-webkit-scrollbar-track {
                  background: #E5E7EB;
                  border-radius: 2px;
                }
                .pipeline-schematic-scroll::-webkit-scrollbar-thumb {
                  background: #9CA3AF;
                  border-radius: 2px;
                }
                .pipeline-schematic-scroll::-webkit-scrollbar-thumb:hover {
                  background: #6B7280;
                }
              `}</style>
              <div className="flex items-center min-w-max pipeline-schematic-scroll">
                {selectedLocation.pipeline.locations && selectedLocation.pipeline.locations.length > 0 ? (
                  selectedLocation.pipeline.locations.map((loc: Location, index: number) => {
                    const isFirst = index === 0;
                    const isLast = index === selectedLocation.pipeline.locations.length - 1;
                    // Green line for first segment (dispatch), grey for others
                    const lineColor = isFirst ? '#10B981' : '#808080';
                    
                    // Determine node styling based on location type (matching map icons)
                    let nodeBgColor = 'bg-gray-600';
                    let nodeBorderColor = 'border-gray-600';
                    
                    if (loc.location_type === 'DISPATCH_TERMINAL') {
                      nodeBgColor = 'bg-emerald-500';
                      nodeBorderColor = 'border-emerald-600';
                    } else if (loc.location_type === 'INTERMEDIATE_PUMPING') {
                      nodeBgColor = 'bg-purple-500';
                      nodeBorderColor = 'border-purple-600';
                    } else if (loc.location_type === 'RECEIVING_TERMINAL') {
                      nodeBgColor = 'bg-blue-500';
                      nodeBorderColor = 'border-blue-600';
                    }
                    
                    return (
                      <React.Fragment key={loc.location_code || index}>
                        {/* Location Node */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div 
                            className={`w-7 h-7 rounded-full flex items-center justify-center border ${nodeBgColor} ${nodeBorderColor} overflow-hidden`}
                          >
                            {loc.location_type === 'DISPATCH_TERMINAL' ? (
                              <img src={dispatchImage} alt="Dispatch" className="w-full h-full object-contain p-0.5" />
                            ) : loc.location_type === 'RECEIVING_TERMINAL' ? (
                              <img src={receivingTerminalImage} alt="Receiving" className="w-full h-full object-contain p-0.5" />
                            ) : (
                              <img src={intermediatePumpingImage} alt="Intermediate" className="w-full h-full object-contain p-0.5" />
                            )}
                          </div>
                          <p className="text-[10px] text-gray-900 mt-0.5 font-medium whitespace-nowrap">{loc.location_name}</p>
                          <p className="text-[9px] text-gray-600 whitespace-nowrap">
                            {loc.location_type?.replace(/_/g, ' ')}
                          </p>
                        </div>
                        
                        {/* Connecting Line */}
                        {!isLast && (
                          <div className="h-0.5 w-10 mx-1 flex-shrink-0" style={{ backgroundColor: lineColor }} />
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <div className="text-[10px] text-gray-500 p-2">No locations available</div>
                )}
              </div>
            </div>
          </div>

          {/* Product Portfolio */}
          <div className="p-2 border-b border-gray-200">
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="h-2.5 w-2.5 text-gray-500" />
              <h3 className="text-[10px] font-semibold text-gray-900">PRODUCT PORTFOLIO</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedLocation.pipeline.products?.map((product: string, index: number) => {
                const productNames: { [key: string]: string } = {
                  'MS': 'Petrol',
                  'HSD': 'Diesel',
                  'SKO': 'Kerosene',
                  'ATF': 'Jet Fuel',
                };
                return (
                  <span
                    key={index}
                    className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded border border-gray-200"
                  >
                    {product} ({productNames[product] || product})
                  </span>
                );
              })}
            </div>
          </div>

          {/* Phase Details */}
          {selectedLocation.pipeline.phases && selectedLocation.pipeline.phases.length > 0 && (
            <div className="p-2 border-b border-gray-200">
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="h-2.5 w-2.5 text-gray-500" />
                <h3 className="text-[10px] font-semibold text-gray-900">PHASE DETAILS</h3>
              </div>
              <div className="space-y-2">
                {selectedLocation.pipeline.phases.map((phase: any, index: number) => (
                  <div key={index} className="bg-gray-50 rounded p-2 border border-gray-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-gray-900">
                        {phase.phase_code || `Phase ${index + 1}`}
                      </span>
                      {phase.commissioning && (
                        <span className="text-[10px] text-gray-600">
                          {phase.commissioning}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[10px] text-gray-700">
                        <span className="font-medium">From:</span>
                        <span>{phase.from || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-700">
                        <span className="font-medium">To:</span>
                        <span>{phase.to || 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-1.5 pt-1.5 border-t border-gray-200">
                        <div>
                          <p className="text-[10px] text-gray-500 mb-0.5">Length</p>
                          <p className="text-[10px] font-semibold text-gray-900">
                            {phase.length_km?.toFixed(2) || '0.00'} km
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 mb-0.5">Pipe Size</p>
                          <p className="text-[10px] font-semibold text-gray-900">
                            {phase.pipe_size_inch || 'N/A'}
                          </p>
                        </div>
                      </div>
                      {phase.line_fill_quantity_kl && (
                        <div className="mt-1 pt-1 border-t border-gray-200">
                          <p className="text-[10px] text-gray-500 mb-0.5">Line Fill Quantity</p>
                          <p className="text-[10px] font-semibold text-gray-900">
                            {phase.line_fill_quantity_kl.toLocaleString()} KL
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Details Cards */}
          <div className="p-2 grid grid-cols-2 gap-2">
            {/* Line Fill Qty Card */}
            <div className="bg-gray-50 rounded p-2 border border-gray-200">
              <div className="flex items-center gap-1.5 mb-1">
                <Droplet className="h-3 w-3 text-orange-500" />
                <p className="text-[10px] text-gray-500">Line Fill Qty</p>
              </div>
              <p className="text-sm font-bold text-gray-900">
                {selectedLocation.pipeline.line_fill_quantity_kl?.toLocaleString() || '0'} KL
              </p>
            </div>

            {/* SV Stations Card */}
            <div className="bg-gray-50 rounded p-2 border border-gray-200">
              <div className="flex items-center gap-1.5 mb-1">
                <Gauge className="h-3 w-3 text-orange-500" />
                <p className="text-[10px] text-gray-500">SV Stations</p>
              </div>
              <p className="text-sm font-bold text-gray-900">
                {selectedLocation.pipeline.sv_stations?.count || 0} Total
              </p>
            </div>
          </div>
        </div>

        {/* Sticky RTMS Button at Bottom */}
        <div className="flex-shrink-0 p-2 border-t border-gray-200 bg-white">
          <button
            onClick={onLaunchSCADA}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[10px] font-semibold py-1.5 px-3 rounded hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md"
          >
            RTMS
            <ExternalLink className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* Pop-out Modal for Pipeline Schematic */}
      {isSchematicExpanded && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setIsSchematicExpanded(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Pipeline Schematic - {selectedLocation.pipeline.name}
              </h2>
              <button
                onClick={() => setIsSchematicExpanded(false)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Close"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Modal Content - Expanded Schematic */}
            <div className="flex-1 overflow-auto p-6">
              <div className="flex items-center justify-center min-w-max">
                {selectedLocation.pipeline.locations && selectedLocation.pipeline.locations.length > 0 ? (
                  selectedLocation.pipeline.locations.map((loc: Location, index: number) => {
                    const isFirst = index === 0;
                    const isLast = index === selectedLocation.pipeline.locations.length - 1;
                    const lineColor = isFirst ? '#10B981' : '#808080';
                    
                    let nodeBgColor = 'bg-gray-600';
                    let nodeBorderColor = 'border-gray-600';
                    
                    if (loc.location_type === 'DISPATCH_TERMINAL') {
                      nodeBgColor = 'bg-emerald-500';
                      nodeBorderColor = 'border-emerald-600';
                    } else if (loc.location_type === 'INTERMEDIATE_PUMPING') {
                      nodeBgColor = 'bg-purple-500';
                      nodeBorderColor = 'border-purple-600';
                    } else if (loc.location_type === 'RECEIVING_TERMINAL') {
                      nodeBgColor = 'bg-blue-500';
                      nodeBorderColor = 'border-blue-600';
                    }
                    
                    return (
                      <React.Fragment key={loc.location_code || index}>
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div 
                            className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${nodeBgColor} ${nodeBorderColor} overflow-hidden shadow-lg`}
                          >
                            {loc.location_type === 'DISPATCH_TERMINAL' ? (
                              <img src={dispatchImage} alt="Dispatch" className="w-full h-full object-contain p-2" />
                            ) : loc.location_type === 'RECEIVING_TERMINAL' ? (
                              <img src={receivingTerminalImage} alt="Receiving" className="w-full h-full object-contain p-2" />
                            ) : (
                              <img src={intermediatePumpingImage} alt="Intermediate" className="w-full h-full object-contain p-2" />
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mt-2 whitespace-nowrap">{loc.location_name}</p>
                          <p className="text-xs text-gray-600 whitespace-nowrap">
                            {loc.location_type?.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-500 whitespace-nowrap mt-1">
                            {loc.location_code}
                          </p>
                        </div>
                        {!isLast && (
                          <div className="h-2 w-24 mx-4 flex-shrink-0 rounded" style={{ backgroundColor: lineColor }} />
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <div className="text-sm text-gray-500 p-4">No locations available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineDetailsPanel;
