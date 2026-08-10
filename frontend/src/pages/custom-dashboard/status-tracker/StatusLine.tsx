import React, { useState } from 'react';
import { Stage } from './types';
import { calculateDotPosition, getMaxStage, getStagesWithCount } from './utils';
import { TooltipContent, TooltipProvider, TooltipTrigger } from '@/@/components/ui/tooltip';
import { Tooltip } from '@mui/material';
import ModalDialogBox from '../charts/ModalDialogBox';

interface StatusLineProps {
  stages: Stage[];
  totalStages: number;
}

export const StatusLine: React.FC<StatusLineProps> = ({ stages, totalStages }) => {
  const stageMap = getStagesWithCount(stages);
  const maxStage = getMaxStage(stages);
  const lineWidth = `${((maxStage - 0.5) / (totalStages - 1)) * 100}%`;

  const [selectedAlert, setSelectedAlert] = useState(null); // Tracks the selected alert

  const openModal = (alert) => {
    setSelectedAlert(alert); // Set the selected alert
  };

  const closeModal = () => {
    setSelectedAlert(null); // Close the modal by resetting the selected alert
  };

  return (
      <div className="relative h-6">
      {/* Animated Line */}
      <div 
        className="absolute top-1/2 left-0 h-0.5 bg-blue-400 transform -translate-y-1/2 animate-grow-line origin-left"
        style={{ width: lineWidth }}
      />
      
      {/* Status Dots */}
        {/* {Object.entries(stageMap).map(([stage, { count, indices }]) => {
          const stageNumber = parseInt(stage);
          const basePosition = calculateDotPosition(stageNumber, totalStages);

          return indices.map((_, index) => {
          // Calculate horizontal offset based on index and total count
          const totalSpacing = 8; // Total spacing in pixels
          const spacing = totalSpacing / (count - 1);
          const offset = count > 1 
              ? -totalSpacing/2 + (index * spacing)
              : 0;
          return (
            <>
              <Tooltip placement='top' title={`Alert ID: ${stages[index].alert_id}`}>
                <div onClick={openModal}
                  key={`${stage}-${index}`}
                  className="status-dot absolute h-3 w-3 border border-blue-500 bg-white rounded-full transform -translate-y-1/2 animate-fade-in transition-all duration-200 hover:scale-100 hover:bg-blue-500"
                  style={{ 
                      left: `calc(${basePosition} + ${offset}px)`,
                      top: '50%',
                  }}
                />
              </Tooltip>
            {isOpen && <ModalDialogBox props={stages[index]} isOpen={isOpen} alert_id={stages[index].alert_id} sendDataToParent={closeModal} />}
            </>
          );
          });
      })} */}




        {Object.entries(stageMap).map(([stage, { count, indices }]) => {
          const stageNumber = parseInt(stage, 10);
          const basePosition = calculateDotPosition(stageNumber, totalStages);
          const totalSpacing = 8; // Total spacing in pixels
          const spacing = count > 1 ? totalSpacing / (count - 1) : 0;

          return indices.map((alertIndex, index) => {
            // Calculate horizontal offset based on index and total count
            const offset = count > 1 ? -totalSpacing / 2 + index * spacing : 0;
            const alert = stages[alertIndex]; // Use alertIndex to get the correct alert

            return (
              <React.Fragment key={`${stage}-${index}`}>
                <Tooltip placement="top" title={`Alert ID: ${alert.alert_id}`}>
                  <div
                    onClick={(e) => {
                      e.stopPropagation(); // Stop event bubbling if needed
                      openModal(alert); // Pass only the specific alert ID
                    }}
                    className="status-dot absolute h-3 w-3 border border-blue-500 bg-white rounded-full transform -translate-y-1/2 animate-fade-in transition-all duration-200 hover:scale-100 hover:bg-blue-500"
                    style={{
                      left: `calc(${basePosition} + ${offset}px)`,
                      top: '50%',
                    }}
                  />
                </Tooltip>
              </React.Fragment>
            );
          });
        })}

        {/* Modal Dialog Box */}
        {selectedAlert && (
          <ModalDialogBox
            props={selectedAlert}
            isOpen={!!selectedAlert}
            alert_id={selectedAlert.alert_id}
            sendDataToParent={closeModal}
          />
        )}
      </div>
  );
};