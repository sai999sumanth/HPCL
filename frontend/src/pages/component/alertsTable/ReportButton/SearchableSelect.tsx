import React, { useState, useMemo } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/@/components/ui/select';
import { Input } from '@/@/components/ui/input';
import { Label } from '@/@/components/ui/label';
import { Button } from '@/@/components/ui/button';
import { Search, X } from 'lucide-react';

// Custom Searchable Select Component
const SearchableSelect = ({ 
  options, 
  value, 
  onValueChange, 
  placeholder, 
  disabled = false,
  maxInitialDisplay = 100 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Sort options alphabetically and filter based on search
  const filteredOptions = useMemo(() => {
    const sortedOptions = [...options].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );

    if (!searchTerm) {
      // Return top N items when no search term
      return sortedOptions.slice(0, maxInitialDisplay);
    }

    // Filter based on search term
    return sortedOptions.filter(option =>
      option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm, maxInitialDisplay]);

  const selectedOption = options.find(opt => opt.id === value);

  return (
    <div className="relative">
      <Select 
        value={value} 
        onValueChange={onValueChange}
        disabled={disabled}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder}>
            {selectedOption ? selectedOption.name : placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Search Input */}
          <div className="flex items-center border-b px-3 pb-2 mb-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              <>
                {!searchTerm && options.length > maxInitialDisplay && (
                  <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                    Showing top {maxInitialDisplay} results. Use search to find more.
                  </div>
                )}
                {filteredOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </>
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No options found.
              </div>
            )}
          </div>
        </SelectContent>
      </Select>
    </div>
  );
};

// Updated form section with searchable selects
const FormSection = ({ 
  formData, 
  handleFormChange, 
  formErrors, 
  locationOptions, 
  isLoadingLocations 
}) => {
  // Sample business unit options (you can replace with your actual data)
  const businessUnitOptions = [
    { id: 'TAS', name: 'TAS - Technical Application Services' },
    { id: 'RO', name: 'RO - Regional Operations' },
    { id: 'LPG', name: 'LPG - Liquefied Petroleum Gas' },
    // Add more options as needed
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label htmlFor="subject">
          Subject <span className="text-red-500">*</span>
        </Label>
        <Input
          id="subject"
          placeholder="Enter subject term..."
          value={formData.subject}
          onChange={(e) => handleFormChange("subject", e.target.value)}
          className={formErrors.subject ? "border-red-500" : ""}
        />
        {formErrors.subject && (
          <p className="text-sm text-red-500">{formErrors.subject}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bu">Business Unit</Label>
        <SearchableSelect
          options={businessUnitOptions}
          value={formData.bu}
          onValueChange={(value) => handleFormChange("bu", value)}
          placeholder="Select business unit..."
          maxInitialDisplay={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location_id">Location</Label>
        <SearchableSelect
          options={locationOptions}
          value={formData.location_id}
          onValueChange={(value) => handleFormChange("location_id", value)}
          placeholder={
            !formData.bu 
              ? "Select business unit first..." 
              : isLoadingLocations 
                ? "Loading locations..." 
                : "Select location..."
          }
          disabled={!formData.bu || isLoadingLocations}
          maxInitialDisplay={100}
        />
      </div>

      <div className="space-y-2 md:col-span-3">
        <Label htmlFor="description">
          Description <span className="text-red-500">*</span>
        </Label>
        <textarea
          id="description"
          placeholder="Describe the issue or feedback..."
          value={formData.description}
          onChange={(e) => handleFormChange("description", e.target.value)}
          rows={4}
          className={`w-full px-3 py-2 border rounded-md resize-none ${
            formErrors.description ? "border-red-500" : "border-gray-300"
          }`}
        />
        {formErrors.description && (
          <p className="text-sm text-red-500">{formErrors.description}</p>
        )}
      </div>
    </div>
  );
};

export { SearchableSelect, FormSection };