import { CustomMultiSelect } from "@/@/components/ui/industrialmultiselect";
import React, { useState } from "react";
// Helper function to calculate approximate width based on text length
const getWidthFromText = (text) => {
    const baseWidth = 100; // Minimum width in pixels
    const charWidth = 8; // Approximate width per character in pixels
    return Math.max(baseWidth, text.length * charWidth);
  };
  
// Sample data for each dropdown
const filterOptions = {
  fiscMonth: [
    { id: "jan", name: "January" },
    { id: "feb", name: "February" },
    { id: "mar", name: "March" },
  ],
  psuPvt: [
    { id: "mjr_psu", name: "Major PSU" },
    { id: "othr_psu", name: "Other PSU" },
    { id: "psu", name: "PSU" },
    { id: "pvt", name: "Private" },
  ],
  zone: [
    { id: "north", name: "North" },
    { id: "south", name: "South" },
    { id: "east", name: "East" },
    { id: "west", name: "West" },
  ],
  state: [
    { id: "dl", name: "Delhi" },
    { id: "mh", name: "Maharashtra" },
    { id: "ka", name: "Karnataka" },
  ],
  rgn: [
    { id: "r1", name: "Region 1" },
    { id: "r2", name: "Region 2" },
    { id: "r3", name: "Region 3" },
  ],
  dist: [
    { id: "d1", name: "District 1" },
    { id: "d2", name: "District 2" },
    { id: "d3", name: "District 3" },
  ],
  cmpny: [
    { id: "c1", name: "Company 1" },
    { id: "c2", name: "Company 2" },
    { id: "c3", name: "Company 3" },
  ],
  sbu: [
    { id: "s1", name: "SBU 1" },
    { id: "s2", name: "SBU 2" },
    { id: "s3", name: "SBU 3" },
  ],
  prod: [
    { id: "p1", name: "Product 1" },
    { id: "p2", name: "Product 2" },
    { id: "p3", name: "Product 3" },
  ],
  saleOwnUse: [
    { id: "sale", name: "Sale" },
    { id: "own_use", name: "Own Use" },
  ],
};

const FilterComponent = () => {
    const [filters, setFilters] = useState({
        fiscMonth: [],
        psuPvt: [],
        mjrPsuOthrPsuPvt: [],
        zone: [],
        state: [],
        rgn: [],
        dist: [],
        cmpny: [],
        sbu: [],
        prod: [],
        saleOwnUse: [],
      });
    
      const formatPlaceholder = (key) => {
        return key
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      };
    
      const resetSubsequentFilters = (filterName) => {
        const filterOrder = Object.keys(filters);
        const filterIndex = filterOrder.indexOf(filterName);
        
        if (filterIndex !== -1) {
          const resetFilters = {};
          filterOrder.forEach((filter, index) => {
            if (index > filterIndex) {
              resetFilters[filter] = [];
            }
          });
          setFilters((prev) => ({
            ...prev,
            ...resetFilters,
          }));
        }
      };
    
      const handleFilterChange = (filterName) => (values) => {
        setFilters((prev) => ({
          ...prev,
          [filterName]: values,
        }));
        resetSubsequentFilters(filterName);
      };
    
      return (
        <div className="w-full px-1 py-0.5">
          <div className="flex flex-row flex-wrap gap-1">
            {Object.keys(filterOptions).map((key) => {
              const placeholder = formatPlaceholder(key);
              const width = `${getWidthFromText(placeholder)}px`;
              
              return (
                <div 
                  key={key} 
                  className="flex-none" 
                  style={{ width }}
                >
                  <CustomMultiSelect
                    options={filterOptions[key]}
                    placeholder={placeholder}
                    onValueChange={handleFilterChange(key)}
                    value={filters[key]}
                    maxWidth={width}
                    className="w-full truncate"
                    defaultValue={[]}
                    maxCount={1} // Show only one selected item, rest as +N
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    };
    
    export default FilterComponent;
    