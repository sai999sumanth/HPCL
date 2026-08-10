import React from "react";

interface TicketFormHeaderProps {
  hideFormButtons: boolean;
  isEditMode: boolean;
  onCancel: () => void;
  isSubmittingOuter: boolean;
  submitButtonText: string;
  formElementsDisabled: boolean;
  ticketId?: string;
  /** When true, disables the submit button (includes validation + loading/readonly states) */
  isSubmitDisabled: boolean;
}

export function TicketFormHeader({
  hideFormButtons,
  isEditMode,
  onCancel,
  isSubmittingOuter,
  submitButtonText,
  formElementsDisabled,
  ticketId,
  isSubmitDisabled,
}: TicketFormHeaderProps) {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
      <div className="max-w-[1400px] mx-auto px-0.5 sm:px-1 md:px-2 h-8 sm:h-9 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-1 sm:gap-2 md:gap-4 min-w-0 flex-1">
          <button
            type="button"
            className="p-0.5 sm:p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0"
            onClick={onCancel}
          />
          <h1 className="text-sm sm:text-base md:text-lg font-semibold tracking-tight md:-ml-4 lg:-ml-6 xl:-ml-8 whitespace-nowrap">
            {isEditMode
              ? ticketId
                ? `Edit Ticket: ${ticketId}`
                : "Edit Ticket"
              : "Add New Ticket"}
          </h1>
        </div>
        {!hideFormButtons && (
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
<button
            type="button"
            className="px-2 sm:px-3 md:px-4 py-0.5 sm:py-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
            onClick={onCancel}
            disabled={isSubmittingOuter}
          >
            <span className="hidden sm:inline">Cancel</span>
            <span className="sm:hidden">✕</span>
          </button>
          <button
            type="submit"
            className="px-3 sm:px-4 md:px-6 py-0.5 sm:py-1 bg-primary hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-md shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            disabled={isSubmitDisabled}
            >
              <span className="hidden xs:inline">
                {isSubmittingOuter ? "Submitting..." : submitButtonText}
              </span>
              <span className="xs:hidden">
                {isSubmittingOuter ? "Submitting..." : "Submit"}
              </span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
