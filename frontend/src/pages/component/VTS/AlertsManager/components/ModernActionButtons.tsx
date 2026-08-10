import React from 'react';
import { Button } from '@/@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface ModernActionButtonsProps {
  selectedCount: number;
  onUnBlockClick: () => void;
}

const ModernActionButtons: React.FC<ModernActionButtonsProps> = ({
  selectedCount,
  onUnBlockClick
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6 border-t">
      <div className="text-sm text-muted-foreground">
        {selectedCount > 0 ? (
          <span className="font-medium text-primary">
            {selectedCount} record{selectedCount !== 1 ? 's' : ''} selected
          </span>
        ) : (
          'Select records to perform actions'
        )}
      </div>
      
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={onUnBlockClick}
          disabled={selectedCount === 0}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="h-4 w-4" />
          Unblock ({selectedCount})
        </Button>
      </div>
    </div>
  );
};

export default ModernActionButtons;
