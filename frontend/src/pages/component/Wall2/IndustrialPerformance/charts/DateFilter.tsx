import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { Calendar } from "lucide-react";
import { Button } from '@/@/components/ui/button';

interface DateFilterProps {
  onDateChange: (dates: { startDate: string; endDate: string } | null) => void;
  isSelected?: boolean;
}

const DateFilter: React.FC<DateFilterProps> = ({ onDateChange, isSelected = false }) => {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = () => {
    if (startDate && endDate) {
      onDateChange({ startDate, endDate });
      setOpen(false);
    }
  };

  const handleCancel = () => {
    setStartDate('');
    setEndDate('');
    onDateChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          size="sm"
          variant={isSelected ? "default" : "outline"}
          className={`px-2 py-1 h-7 ${
            isSelected 
              ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600" 
              : ""
          }`}
        >
          <Calendar className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="flex justify-between mb-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-32 rounded-md border border-input px-3 py-1 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-32 rounded-md border border-input px-3 py-1 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button 
            size="sm"
            onClick={handleSubmit}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateFilter;