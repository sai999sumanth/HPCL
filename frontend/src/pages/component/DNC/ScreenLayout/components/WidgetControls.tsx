import React from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useLayoutStore } from '@/redux/features/useLayoutStore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/@/components/ui/alert-dialog';

interface WidgetControlsProps {
  widgetId: string;
  isFullscreen: boolean;
}

export const WidgetControls: React.FC<WidgetControlsProps> = ({ widgetId, isFullscreen }) => {
  const { removeWidget, setFullscreenWidget } = useLayoutStore();

  const handleDelete = (e: React.MouseEvent) => {
    // Prevent event from bubbling up and default behavior
    e.preventDefault();
    e.stopPropagation();
    
    // Add more detailed logging
    console.warn('Attempting to delete widget:', widgetId);
    
    // Ensure removeWidget is called with the correct type
    removeWidget(widgetId);
  };

  const handleFullscreen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFullscreenWidget(isFullscreen ? null : widgetId);
  };

  const stopPropagation = (event) => {
    event.stopPropagation();
  };

  return (
    <React.Fragment>
      <div 
        className="flex items-center space-x-2" 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <button
          onClick={handleFullscreen}
          onMouseDown={stopPropagation}
          onTouchStart={stopPropagation}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4 text-gray-600" />
          ) : (
            <Maximize2 className="w-4 h-4 text-gray-600" />
          )}
        </button>
        <button
          type="button"  // Explicitly set type to prevent form submission
          onClick={handleDelete}
          onMouseDown={stopPropagation}
          onTouchStart={stopPropagation}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Delete Widget"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
      </div>


      <AlertDialog >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enter your screen name</AlertDialogTitle>
            <AlertDialogDescription>Enter or Select your screen name</AlertDialogDescription>
          </AlertDialogHeader>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </React.Fragment>
  );
};