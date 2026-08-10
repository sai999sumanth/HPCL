import React, { useState, useEffect } from 'react';
import { Minimize2 } from 'lucide-react';

import { TicketDashboard } from './ticket-dashboard';
import { CreateTicketDialog } from './CreateTicketDialog';

interface TicketDialogModalProps {
  isOpen: boolean;
  isMinimized: boolean;
  initialData: any;
  onClose: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  onSubmitSuccess?: () => void;
  ticketSection?: string;
}

export const TicketDialogModal: React.FC<TicketDialogModalProps> = ({
  isOpen,
  isMinimized,
  initialData,
  onClose,
  onMinimize,
  onRestore,
  onSubmitSuccess,
  ticketSection,
}) => {
  console.log('TicketDialogModal received initialData:', initialData);
  const [showDashboard, setShowDashboard] = useState(false);

  // Reset to create form when modal is opened (e.g. from OngoingTripChartTable, RiskScoreDash, AlertTableV2)
  useEffect(() => {
    if (isOpen) {
      setShowDashboard(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // When opened from LPG, SOD, RiskScore, OngoingTripChartTable: X always closes the modal.
  const handleClose = () => onClose();

  return (
    <>
      {/* Modal Overlay - always present but hidden when minimized */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999999998,
          display: isMinimized ? 'none' : 'block',
        }}
        onClick={handleClose}
      />

      {/* Dialog Container with Controls - right slide popup like TopBar */}
      <div
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[98%] md:w-[95%] lg:w-[90%] max-w-[1700px] bg-white flex flex-col"
        style={{
          zIndex: 999999999,
          visibility: isMinimized ? 'hidden' : 'visible',
          boxShadow: '-10px 0 25px -5px rgba(0, 0, 0, 0.1)',
          animation: 'slideInRight 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            // padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            position: 'relative',
          }}
        >
          {/* Button container - keeps buttons side by side */}
          <div className="absolute top-3 z-[1000000000] flex items-center gap-1 left-2 md:-left-[72px]">
            {/* Close button - from create form shows dashboard; from dashboard closes modal */}
            <button
              onClick={handleClose}
              className="group bg-white hover:bg-gray-100 rounded-full p-1.5 shadow-lg border border-gray-200 w-8 h-8 flex items-center justify-center transition-all duration-300 hover:scale-105"
              title="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 group-hover:text-gray-900">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            {/* Minimize button */}
            <button
              onClick={onMinimize}
              className="group bg-white hover:bg-gray-100 rounded-full p-1.5 shadow-lg border border-gray-200 w-8 h-8 flex items-center justify-center transition-all duration-300 hover:scale-105"
              title="Minimize"
            >
              <Minimize2 className="h-3 w-3 text-gray-600 group-hover:text-gray-900" />
            </button>
          </div>
          {/* <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            margin: 0,
            marginLeft: '16px',
            textAlign: 'left',
            flex: 1
          }}>
            {showDashboard ? 'Tickets Dashboard' : 'Create / Edit Ticket'}
          </h2> */}
        </div>

        {/* Dialog Content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {showDashboard ? (
            <TicketDashboard useOverlayMode={true} />
          ) : (
            <CreateTicketDialog
              open={true}
              onOpenChange={(open) => {
                // On Cancel button → show ticket dashboard; X button → close modal (via handleClose)
                if (!open) setShowDashboard(true);
              }}
              isMinimized={isMinimized}
              onMinimizeChange={() => {}} // Handled by parent
              initialData={initialData}
              onSubmitSuccess={() => setShowDashboard(true)}
              ticketSection={ticketSection}
            />
          )}
        </div>
      </div>

      {/* Minimized Ticket Indicator */}
      {isMinimized && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
          }}
        >
          <button
            onClick={onRestore}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all transform hover:scale-105"
            style={{
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold">{showDashboard ? 'Tickets Dashboard' : 'Create Ticket'}</span>
              <span className="text-xs opacity-90">Click to restore</span>
            </div>
          </button>
        </div>
      )}
    </>
  );
};

export default TicketDialogModal;
