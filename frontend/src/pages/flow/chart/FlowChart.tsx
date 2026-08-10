import React, { useCallback, useState } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
} from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isValid, parseISO } from "date-fns";
import { X, Clock, AlertTriangle, Wrench, Info } from "lucide-react";
import "@xyflow/react/dist/base.css";
import Legend from "../legend/Legend";
import { statusColors } from "../util/util";
import { Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";

// Define a type for the parsed device object for type safety
interface ParsedDevice {
  name: string;
  timestamp: any;
  parsedTimestamp: Date | null;
}

const BasicNode = ({ data }) => {
  const {
    status = "",
    name = "",
    iconSrc = "",
    showTopEdge = false,
    showBottomEdge = false,
    lrcHighlight = null,
  } = data;

  const iconStyle =
    lrcHighlight === "slave"
      ? { filter: "saturate(2.8) hue-rotate(-42deg) brightness(0.92)" }
      : undefined;

  const nodeContent = (
    <div
      className="px-3 py-2 flex flex-col items-center relative border-4 border-gray-500 rounded-lg shadow-lg cursor-pointer"
      style={{ pointerEvents: 'all' }}
    >
      <img
        width="50"
        height="50"
        src={`${iconSrc}`}
        alt={name}
        className="cursor-pointer"
        style={iconStyle}
      />
      <div className="mt-2 font-medium">{name}</div>
      {showTopEdge && <Handle type="target" position={Position.Top} />}
      {showBottomEdge && <Handle type="source" position={Position.Bottom} />}
    </div>
  );

  // Only show tooltip if status data is available
  if (status && status !== "" && status !== "N/A") {
    return (
      <Tooltip
        title={`Status: ${status}`}
        placement="top"
        arrow
        followCursor
        enterDelay={0}
        leaveDelay={0}
      >
        {nodeContent}
      </Tooltip>
    );
  }

  return nodeContent;
};

const AdvancedNode = ({ data, onFaultyClick, onMaintenanceClick }) => {
  const {
    status = "",
    name = "",
    iconSrc = "",
    showTopEdge = false,
    showRightEdge = false,
    showBottomEdge = false,
    total = 0,
    faulty = 0,
    maintanance = 0,
    faultyDeviceName,
    maintananceDeviceName,
  } = data;

  const isDataAvailable = total !== "N/A" && faulty !== "N/A" && maintanance !== "N/A";
  const hasStatus = status && status !== "" && status !== "N/A";

  // Convert to numbers for comparison
  const faultyCount = typeof faulty === 'number' ? faulty : parseInt(faulty) || 0;
  const maintenanceCount = typeof maintanance === 'number' ? maintanance : parseInt(maintanance) || 0;

  const handleFaultyClick = (e) => {
    e.stopPropagation();
    // Only trigger click if faulty count > 0 and we have device names
    if (faultyCount > 0 && faultyDeviceName && onFaultyClick) {
      onFaultyClick(faultyDeviceName);
    }
  };

  const handleMaintenanceClick = (e) => {
    e.stopPropagation();
    // Only trigger click if maintenance count > 0 and we have device names
    if (maintenanceCount > 0 && maintananceDeviceName && onMaintenanceClick) {
      onMaintenanceClick(maintananceDeviceName);
    }
  };

  const nodeContent = (
    <div
      className="px-2 py-2 flex flex-col items-center relative border-4 border-gray-500 rounded-lg cursor-pointer"
      style={{ pointerEvents: 'all' }}
    >
      {hasStatus && (
        <div className="flex space-x-1 mb-1 mt-1">
          <div className={`w-3 h-3 rounded-full ${statusColors[status]}`} />
        </div>
      )}

      <img width="50" height="50" src={`${iconSrc}`} alt={name} className="cursor-pointer" />

      <div className="mt-2">{name}</div>

      <div className="flex space-x-2 mt-2" style={{ pointerEvents: 'all' }}>
        {isDataAvailable ? (
          <>
            <Badge count={total} color={statusColors.grey} />
            <Badge
              count={maintanance}
              color={statusColors.orange}
              onClick={maintenanceCount > 0 ? handleMaintenanceClick : undefined}
              clickable={maintenanceCount > 0 && !!maintananceDeviceName}
            />
            <Badge
              count={faulty}
              color={statusColors.red}
              onClick={faultyCount > 0 ? handleFaultyClick : undefined}
              clickable={faultyCount > 0 && !!faultyDeviceName}
            />
          </>
        ) : (
          <div className="text-gray-500 text-xs">N/A</div>
        )}
      </div>

      {showTopEdge && <Handle type="target" position={Position.Top} />}
      {showBottomEdge && <Handle type="target" position={Position.Bottom} />}
      {showRightEdge && <Handle type="target" position={Position.Right} />}
    </div>
  );

  // Only show main tooltip if status data is available
  if (hasStatus) {
    return (
      <Tooltip
        title={`Status: ${status}`}
        placement="top"
        arrow
        followCursor
        enterDelay={0}
        leaveDelay={0}
      >
        {nodeContent}
      </Tooltip>
    );
  }

  return nodeContent;
};

interface BadgeProps {
  count: number | string;
  color: string;
  onClick?: (e: React.MouseEvent) => void;
  clickable?: boolean;
}

const Badge: React.FC<BadgeProps> = ({ count, color, onClick, clickable = false }) => {
  return (
    <div
      className={`w-6 h-6 flex items-center justify-center text-white text-sm font-bold rounded-full ${color} ${clickable ? 'cursor-pointer hover:opacity-80' : ''
        }`}
      onClick={onClick}
    >
      {count}
    </div>
  );
};

const GroupNode = ({ data }) => {
  const {
    name = "",
    showTopEdge = false,
    showBottomEdge = false,
    showRightEdge = false,
    showLeftEdge = false,
    items = [],
    status = "",
    // New props for PLC data
    plcData,
  } = data;

  const hasStatus = status && status !== "" && status !== "N/A";
  const isProcessOrSafety = name.toLowerCase().includes('process') || name.toLowerCase().includes('safety');

  // Create tooltip content for Process and Safety nodes
  const createTooltipContent = () => {
    // If it's a Process or Safety node, show PLC data from items array
    if (isProcessOrSafety) {
      const tooltipLines = [];

      // Get PLC data from items array
      items.forEach(item => {
        if (item.name && item.status) {
          tooltipLines.push(`${item.name}: ${item.status}`);
        }
      });

      return (
        <div>
          {tooltipLines.map((line, index) => (
            <div key={index} style={{ marginBottom: index < tooltipLines.length - 1 ? '4px' : '0' }}>
              {line}
            </div>
          ))}
        </div>
      );
    }

    // For non-process/safety nodes, show regular status
    return `Status: ${status}`;
  };

  const nodeContent = (
    <div
      className="px-4 py-3 flex flex-col items-center relative border-4 border-gray-200 rounded-lg shadow-lg cursor-pointer"
      style={{ pointerEvents: 'all' }}
    >
      {/* Parent Node Details */}
      <div className="mb-2 mx-auto">
        <span className="font-semibold">{name}</span>
      </div>

      {/* Child Nodes */}
      <div className="flex flex-wrap justify-center gap-3">
        {items.map((item, index) => {
          const itemContent = (
            <div
              className="p-2 pb-0 bg-gray-200 rounded-md shadow-sm flex flex-col items-center cursor-pointer"
              style={{ pointerEvents: 'all' }}
            >
              {item.iconSrc && (
                <img
                  width="30"
                  height="30"
                  src={item.iconSrc}
                  alt={item.name}
                  className="cursor-pointer"
                />
              )}
              <span className="text-sm">{item.name}</span>
            </div>
          );

          // Check if this is a PLC item (PLC A or PLC B)
          const isPLCItem = item.name && (
            item.name.toLowerCase().includes('plc a') ||
            item.name.toLowerCase().includes('plc b')
          );

          // Only show tooltip for child items if they have status AND are not PLC items
          if (item?.status && item.status !== "" && item.status !== "N/A" && !isPLCItem) {
            return (
              <Tooltip
                key={index}
                title={`Status: ${item.status}`}
                placement="top"
                arrow
                followCursor
                enterDelay={0}
                leaveDelay={0}
              >
                {itemContent}
              </Tooltip>
            );
          }

          return <div key={index}>{itemContent}</div>;
        })}
      </div>

      {/* Handles for connecting */}
      {showTopEdge && <Handle type="target" position={Position.Top} />}
      {showBottomEdge && <Handle type="source" position={Position.Bottom} />}
      {showRightEdge && <Handle type="source" position={Position.Right} />}
      {showLeftEdge && <Handle type="source" position={Position.Left} />}
    </div>
  );

  // Show tooltip if status data is available OR if it's a Process/Safety node
  if (hasStatus || isProcessOrSafety) {
    return (
      <Tooltip
        title={createTooltipContent()}
        placement="top"
        arrow
        followCursor
        enterDelay={0}
        leaveDelay={0}
      >
        {nodeContent}
      </Tooltip>
    );
  }

  return nodeContent;
}

const parseTimestamp = (timestamp: any): Date | null => {
  if (!timestamp || typeof timestamp !== 'string') return null;

  try {
    // Handles formats like "YYYY-MM-DD HH:MM:SS"
    const compliantTimestamp = timestamp.replace(' ', 'T');
    const date = parseISO(compliantTimestamp);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
};

const parseDeviceData = (deviceNames: any): ParsedDevice[] => {
  if (!deviceNames) {
    return [];
  }

  if (Array.isArray(deviceNames)) {
    return deviceNames.map((device: string) => ({
      name: device,
      timestamp: null,
      parsedTimestamp: null,
    }));
  }

  if (typeof deviceNames === 'string') {
    return [
      {
        name: deviceNames,
        timestamp: null,
        parsedTimestamp: null,
      },
    ];
  }

  if (typeof deviceNames === 'object') {
    return Object.entries(deviceNames).map(([deviceName, timestamp]: [string, any]) => ({
      name: deviceName,
      timestamp: timestamp,
      parsedTimestamp: parseTimestamp(timestamp),
    }));
  }

  return [
    {
      name: String(deviceNames),
      timestamp: null,
      parsedTimestamp: null,
    },
  ];
};

type EnhancedModalProps = {
  open: boolean;
  onClose: () => void;   // <- no arguments
  title: string;
  deviceNames: any;
  nodeName?: string;
};


const EnhancedModal: React.FC<EnhancedModalProps> = ({ open, onClose, title, deviceNames, nodeName }) => {
  const devices: ParsedDevice[] = parseDeviceData(deviceNames);
  const isFaulty = title.toLowerCase().includes('faulty');
  const isMaintenanceModal = title.toLowerCase().includes('maintenance');


  if (!open) return null;


  const deviceNamesList = devices.map((d) => d.name).filter(Boolean);
  let heading = title;
  if (nodeName) heading += ` - ${nodeName}`;
  if (deviceNamesList.length > 0) heading += ` (${deviceNamesList.join(', ')})`;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 rounded-t-lg ${isFaulty ? 'bg-red-50' : isMaintenanceModal ? 'bg-orange-50' : 'bg-gray-50'
              }`}>
              <div className="flex items-center gap-3">
                {isFaulty ? (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                ) : isMaintenanceModal ? (
                  <Wrench className="w-5 h-5 text-orange-500" />
                ) : (
                  <Clock className="w-5 h-5 text-gray-500" />
                )}
                <h2 className={`text-lg font-semibold ${isFaulty ? 'text-red-800' : isMaintenanceModal ? 'text-orange-800' : 'text-gray-800'
                  }`}>
                  {title} ({nodeName})
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {devices.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 w-3/5">Equipment ID</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 w-2/5">Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {devices.map((device, index) => (
                        <motion.tr
                          key={device.name + index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: index * 0.05, duration: 0.2 }}
                          className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50"
                        >
                          <td className="px-4 py-2.5 text-gray-800 font-medium">
                            {device.name}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 font-mono">
                            {device.parsedTimestamp
                              ? format(device.parsedTimestamp, 'MMM d, yyyy HH:mm:ss')
                              : device.timestamp || 'N/A'
                            }
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center flex flex-col items-center justify-center h-full">
                  <div className="text-gray-300 mb-3">
                    <AlertTriangle className="w-10 h-10 mx-auto" />
                  </div>
                  <p className="text-gray-500">
                    No device information available.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-between items-center">
              <span className="text-sm text-gray-500">
                Total: <span className="font-semibold text-gray-700">{devices.length}</span>
              </span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-gray-600 text-white text-sm font-semibold rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface FlowChartProps {
  data?: any;
  count?: {
    total: number | string;
    maintanance: number | string;
    faulty: number | string;
  };
  faultyDevices?: string[] | string | object;
  maintenanceDevices?: string[] | string | object;
  onTotalClick?: () => void;
}

const FlowChart: React.FC<FlowChartProps> = ({
  data = {},
  count = {
    total: 0,
    maintanance: 0,
    faulty: 0,
  },
  faultyDevices = [],
  maintenanceDevices = [],
  onTotalClick,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(data?.initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(data?.initEdges);

  const [modalState, setModalState] = useState({
    open: false,
    type: null as 'faulty' | 'maintenance' | null,
    data: null as any,
    nodeName: '' as string,
  });

  const proOptions = { hideAttribution: true };

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const maintenanceCount = typeof count.maintanance === 'number' ? count.maintanance : 0;
  const faultyCount = typeof count.faulty === 'number' ? count.faulty : 0;

  const handleFaultySummaryClick = (nodeName: string) => {
    if (faultyCount > 0) {
      setModalState({
        open: true,
        type: 'faulty',
        data: faultyDevices,
        nodeName,
      });
    }
  };

  const handleMaintenanceSummaryClick = (nodeName: string) => {
    if (maintenanceCount > 0) {
      setModalState({
        open: true,
        type: 'maintenance',
        data: maintenanceDevices,
        nodeName
      });
    }
  };

  const handleNodeFaultyClick = (deviceData: any, nodeName: string) => {
    setModalState({
      open: true,
      type: 'faulty',
      data: deviceData,
      nodeName,
    });
  };
  const handleNodeMaintenanceClick = (deviceData: any, nodeName: string) => {
    setModalState({
      open: true,
      type: 'maintenance',
      data: deviceData,
      nodeName,
    });
  };

  const handleModalClose = () => {
    setModalState({
      open: false,
      type: null,
      data: null,
      nodeName: ''
    });
  };

  const nodeTypes = {
    basic: BasicNode,
    customGroup: GroupNode,
    advanced: (nodeProps: any) => (
      <AdvancedNode
        {...nodeProps}
        onFaultyClick={(deviceData: any) => handleNodeFaultyClick(deviceData, nodeProps.data?.name)}
        onMaintenanceClick={(deviceData: any) => handleNodeMaintenanceClick(deviceData, nodeProps.data?.name)}
      />
    ),
  };

  const isDataAvailable =
    typeof count.total === 'number' &&
    typeof count.maintanance === 'number' &&
    typeof count.faulty === 'number';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        proOptions={proOptions}
        nodeTypes={nodeTypes}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        panOnDrag={false}
        preventScrolling={true}
        fitView
        fitViewOptions={{
          padding: 0.06,
          includeHiddenNodes: false,
          minZoom: 0.1,
          maxZoom: 2,
        }}
        defaultViewport={{ x: 0, y: 0, zoom: 1.5 }}
        className="bg-gray-100"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        selectNodesOnDrag={false}
      >
        <div className="absolute top-2 left-2 z-10" style={{ pointerEvents: 'none' }}>
          <Legend />
        </div>
        <div className="absolute top-2 right-2 z-10" style={{ pointerEvents: 'auto' }}>
          <div className="bg-white shadow-lg p-2 border border-gray-300 rounded-lg">
            <div className="flex gap-x-4 text-sm font-semibold">
              <p className="flex items-center gap-1">
                Total:{" "}
                <span
                  className={`text-black ${isDataAvailable && onTotalClick ? 'cursor-pointer hover:underline hover:text-blue-700 transition-colors' : ''}`}
                  onClick={isDataAvailable && onTotalClick ? onTotalClick : undefined}
                >
                  {isDataAvailable ? count?.total : "N/A"}
                </span>
                {isDataAvailable && onTotalClick && (
                  <span title="Click to view equipment details">
                    <Info
                      className="w-4 h-4 text-blue-600 cursor-pointer hover:text-blue-800 transition-colors"
                      onClick={onTotalClick}
                    />
                  </span>
                )}
              </p>
              <p className="text-yellow-600">
                Maintenance:{" "}
                <span
                  className={`font-normal ${isDataAvailable && maintenanceCount > 0
                      ? 'cursor-pointer hover:underline hover:text-orange-700 transition-colors'
                      : 'cursor-default'
                    }`}
                  onClick={
                    isDataAvailable && maintenanceCount > 0
                      ? () => handleMaintenanceSummaryClick("Summary")
                      : undefined
                  }
                >
                  {isDataAvailable ? count?.maintanance : "N/A"}
                </span>
              </p>
              <p className="text-red-600">
                Faulty:{" "}
                <span
                  className={`font-normal ${isDataAvailable && faultyCount > 0
                      ? 'cursor-pointer hover:underline hover:text-red-700 transition-colors'
                      : 'cursor-default'
                    }`}
                  onClick={isDataAvailable && faultyCount > 0 ? () => handleFaultySummaryClick : undefined}
                >
                  {isDataAvailable ? count?.faulty : "N/A"}
                </span>
              </p>
            </div>
          </div>
        </div>
      </ReactFlow>

      <EnhancedModal
        open={modalState.open}
        onClose={handleModalClose}
        title={
          modalState.type === 'faulty'
            ? 'Faulty Equipment'
            : modalState.type === 'maintenance'
              ? 'Maintenance Equipment'
              : ''
        }
        deviceNames={modalState.data}
        nodeName={modalState.nodeName}
      />
    </div>
  );
};

export default FlowChart;
