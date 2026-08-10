// import { useState } from "react";
// import { Card } from "../../@/components/ui/card";
// import { FilterSelect } from "./FilterSelect";
// import { Separator } from "../../@/components/ui/separator";
// import { Switch } from "../../@/components/ui/switch";
// import { Label } from "../../@/components/ui/label";

// const levels = ["District", "City", "State", "Zone", "Area"].map((level) => ({
//   label: level,
//   value: level.toLowerCase(),
// }));

// const billingAccounts = [
//   { label: "Gondor", value: "gondor" },
//   { label: "Hobbiton", value: "hobbiton" },
//   { label: "Mordor", value: "mordor" },
//   { label: "Rohan", value: "rohan" },
//   { label: "Rivendell", value: "rivendell" },
//   { label: "Minas Tirith", value: "minas-tirith" },
// ];

// export function ChartWrapper() {
//   const [filters, setFilters] = useState({
//     l1: "",
//     l2: "",
//     l3: "",
//     l4: "",
//     l5: "",
//     l6: "",
//     billingAccount: "",
//   });

//   const [showSelected, setShowSelected] = useState(false);

//   return (
//     <div className="p-6 space-y-6">
//       <div className="flex items-center justify-between">
//         <h2 className="text-2xl font-semibold tracking-tight">Controls</h2>
//         <div className="flex items-center space-x-2">
//           <Switch
//             id="show-selected"
//             checked={showSelected}
//             onCheckedChange={setShowSelected}
//           />
//           <Label htmlFor="show-selected">Show selected</Label>
//         </div>
//       </div>

//       <Card className="p-6">
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
//           {levels.map((level, index) => (
//             <FilterSelect
//               key={level.value}
//               label={level.label}
//               options={billingAccounts}
//               value={filters[`l${index + 1}` as keyof typeof filters]}
//               onChange={(value) =>
//                 setFilters((prev) => ({
//                   ...prev,
//                   [`l${index + 1}`]: value,
//                 }))
//               }
//             />
//           ))}
//         </div>

//         <Separator className="my-6" />

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//           <FilterSelect
//             label="Billing Account Id"
//             options={billingAccounts}
//             value={filters.billingAccount}
//             onChange={(value) =>
//               setFilters((prev) => ({ ...prev, billingAccount: value }))
//             }
//           />
//         </div>
//       </Card>

//       {/* Preview Section */}
//       <Card className="p-6">
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//           <div>
//             <h3 className="font-medium mb-4">Selected Filters</h3>
//             <pre className="bg-muted p-4 rounded-lg text-sm">
//               {JSON.stringify(filters, null, 2)}
//             </pre>
//           </div>
//         </div>
//       </Card>
//     </div>
//   );
// }



// import { useState } from "react";
// import { Card } from "../../@/components/ui/card";
// import { FilterSelect } from "./FilterSelect";
// import { Separator } from "../../@/components/ui/separator";
// import { Switch } from "../../@/components/ui/switch";
// import { Label } from "../../@/components/ui/label";

// const levels = ["District", "City", "State", "Zone", "Area"].map((level) => ({
//   label: level,
//   value: level.toLowerCase(),
// }));

// const billingAccounts = [
//   { label: "Gondor", value: "gondor" },
//   { label: "Hobbiton", value: "hobbiton" },
//   { label: "Mordor", value: "mordor" },
//   { label: "Rohan", value: "rohan" },
//   { label: "Rivendell", value: "rivendell" },
//   { label: "Minas Tirith", value: "minas-tirith" },
// ];

// interface Filters {
//   l1: string[];
//   l2: string[];
//   l3: string[];
//   l4: string[];
//   l5: string[];
//   l6: string[];
//   billingAccount: string[];
// }

// /**
//  * Renders a global filter component with multiple levels of selection and a billing account filter.
//  * 
//  * This component provides a user interface with toggleable options for displaying selected filters.
//  * It utilizes a series of filter select components to allow users to choose from predefined options
//  * for different levels and billing accounts. It also displays the currently selected filters in a 
//  * formatted JSON structure.
//  * 
//  * State:
//  * - `filters`: An object holding the selected values for different levels and billing accounts.
//  * - `showSelected`: A boolean indicating whether to show selected filters.
//  * 
//  * UI Components:
//  * - `Switch`: Toggles the visibility of selected filters.
//  * - `FilterSelect`: Provides a dropdown for each level and billing account to select options.
//  * - `Card`: Used to contain and style different sections of the UI.
//  * - `Separator`: Adds a visual separator between filter sections.
//  * - `Label`: Describes the switch control for showing selected filters.
//  */

// export function ChartWrapper() {
//   const [filters, setFilters] = useState<Filters>({
//     l1: [],
//     l2: [],
//     l3: [],
//     l4: [],
//     l5: [],
//     l6: [],
//     billingAccount: [],
//   });

//   const [showSelected, setShowSelected] = useState(false);

//   return (
//     <div className="p-6 space-y-6">
//       <div className="flex items-center justify-between">
//         <h2 className="text-2xl font-semibold tracking-tight">Controls</h2>
//         <div className="flex items-center space-x-2">
//           <Switch
//             id="show-selected"
//             checked={showSelected}
//             onCheckedChange={setShowSelected}
//           />
//           <Label htmlFor="show-selected">Show selected</Label>
//         </div>
//       </div>

//       <Card className="p-6">
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
//           {levels.map((level, index) => (
//             <FilterSelect
//               key={level.value}
//               label={`L${index + 1}`}
//               options={billingAccounts}
//               value={filters[`l${index + 1}` as keyof typeof filters]}
//               onChange={(value) =>
//                 setFilters((prev) => ({
//                   ...prev,
//                   [`l${index + 1}`]: value,
//                 }))
//               }
//             />
//           ))}
//         </div>

//         <Separator className="my-6" />

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//           <FilterSelect
//             label="Billing Account Id"
//             options={billingAccounts}
//             value={filters.billingAccount}
//             onChange={(value) =>
//               setFilters((prev) => ({ ...prev, billingAccount: value }))
//             }
//           />
//         </div>
//       </Card>

//       {/* Preview Section */}
//       <Card className="p-6">
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//           <div>
//             <h3 className="font-medium mb-4">Selected Filters</h3>
//             <pre className="bg-muted p-4 rounded-lg text-sm">
//               {JSON.stringify(filters, null, 2)}
//             </pre>
//           </div>
//         </div>
//       </Card>
//     </div>
//   );
// }




// import { useState } from "react";
// import { Card } from "../../@/components/ui/card";
// import { FilterSelect } from "./FilterSelect";
// import { Separator } from "../../@/components/ui/separator";
// import { Switch } from "../../@/components/ui/switch";
// import { Label } from "../../@/components/ui/label";

// const levels = ["L1", "L2", "L3", "L4", "L5", "L6"].map((level) => ({
//   label: level,
//   value: level.toLowerCase(),
// }));

// const billingAccounts = [
//   { label: "Gondor", value: "gondor" },
//   { label: "Hobbiton", value: "hobbiton" },
//   { label: "Mordor", value: "mordor" },
//   { label: "Rohan", value: "rohan" },
//   { label: "Rivendell", value: "rivendell" },
//   { label: "Minas Tirith", value: "minas-tirith" },
// ];

// interface Filters {
//   l1: string[];
//   l2: string[];
//   l3: string[];
//   l4: string[];
//   l5: string[];
//   l6: string[];
//   billingAccount: string[];
// }

// export function ChartWrapper() {
//   const [filters, setFilters] = useState<Filters>({
//     l1: [],
//     l2: [],
//     l3: [],
//     l4: [],
//     l5: [],
//     l6: [],
//     billingAccount: [],
//   });

//   const [showSelected, setShowSelected] = useState(false);

//   return (
//     <div className="p-6 space-y-6">
//       <div className="flex items-center justify-between">
//         <h2 className="text-2xl font-semibold tracking-tight">Controls</h2>
//         <div className="flex items-center space-x-2">
//           <Switch
//             id="show-selected"
//             checked={showSelected}
//             onCheckedChange={setShowSelected}
//           />
//           <Label htmlFor="show-selected">Show selected</Label>
//         </div>
//       </div>

//       <Card className="p-6">
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
//           {levels.map((level, index) => (
//             <FilterSelect
//               key={level.value}
//               label={`L${index + 1}`}
//               options={billingAccounts}
//               value={filters[`l${index + 1}` as keyof typeof filters]}
//               onChange={(value) =>
//                 setFilters((prev) => ({
//                   ...prev,
//                   [`l${index + 1}`]: value,
//                 }))
//               }
//             />
//           ))}
//         </div>

//         <Separator className="my-6" />

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//           <FilterSelect
//             label="Billing Account Id"
//             options={billingAccounts}
//             value={filters.billingAccount}
//             onChange={(value) =>
//               setFilters((prev) => ({ ...prev, billingAccount: value }))
//             }
//           />
//         </div>
//       </Card>

//       {/* Preview Section */}
//       <Card className="p-6">
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//           <div>
//             <h3 className="font-medium mb-4">Selected Filters</h3>
//             <pre className="bg-muted p-4 rounded-lg text-sm">
//               {JSON.stringify(filters, null, 2)}
//             </pre>
//           </div>
//         </div>
//       </Card>
//     </div>
//   );
// }






// import { useState } from "react";
// import { Card } from "../../@/components/ui/card";
// import { FilterSelect } from "./FilterSelect";
// import { Separator } from "../../@/components/ui/separator";
// import { Switch } from "../../@/components/ui/switch";
// import { Label } from "../../@/components/ui/label";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { z } from "zod";
// import {
//   Form,
//   FormControl,
//   FormDescription,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from "../../@/components/ui/form";
// import { MultiSelect } from "./multi-select";
// import { Button } from "../../@/components/ui/button";
// import { Cat, Dog, Fish, Rabbit, Turtle } from "lucide-react";
// import { toast } from "sonner";

// const levels = ["L1", "L2", "L3", "L4", "L5"].map((level) => ({
//   label: level,
//   value: level.toLowerCase(),
// }));

// const billingAccounts = [
//   { label: "Gondor", value: "gondor" },
//   { label: "Hobbiton", value: "hobbiton" },
//   { label: "Mordor", value: "mordor" },
//   { label: "Rohan", value: "rohan" },
//   { label: "Rivendell", value: "rivendell" },
//   { label: "Minas Tirith", value: "minas-tirith" },
// ];

// interface Filters {
//   l1: string[];
//   l2: string[];
//   l3: string[];
//   l4: string[];
//   l5: string[];
//   billingAccount: string[];
// }

// const FormSchema = z.object({
//   frameworks: z
//     .array(z.string().min(1))
//     .min(1)
//     .nonempty("Please select at least one framework."),
// });

// interface ChartWrapperProps {
//   children: React.ReactNode; // Add this line to define the children prop
// }

// export const ChartWrapper: React.FC<ChartWrapperProps> = ({ children }) => {
//   const [filters, setFilters] = useState<Filters>({
//     l1: [],
//     l2: [],
//     l3: [],
//     l4: [],
//     l5: [],
//     billingAccount: [],
//   });

//   const frameworksList = [
//     {
//       value: "next.js",
//       label: "Next.js",
//       icon: Dog,
//     },
//     {
//       value: "sveltekit",
//       label: "SvelteKit",
//       icon: Cat,
//     },
//     {
//       value: "nuxt.js",
//       label: "Nuxt.js",
//       icon: Turtle,
//     },
//     {
//       value: "remix",
//       label: "Remix",
//       icon: Rabbit,
//     },
//     {
//       value: "astro",
//       label: "Astro",
//       icon: Fish,
//     },
//   ];

//   const [showSelected, setShowSelected] = useState(false);

//   const form = useForm<z.infer<typeof FormSchema>>({
//     resolver: zodResolver(FormSchema),
//     defaultValues: {
//       frameworks: ["next.js", "nuxt.js"],
//     },
//   });

//   function onSubmit(data: z.infer<typeof FormSchema>) {
//     toast.success(
//       `You have selected following frameworks: ${data.frameworks.join(", ")}.`
//     );
//   }

//   return (
//     <div className="p-6 space-y-6">
//       <div className="flex items-center justify-between">
//         <h2 className="text-2xl font-semibold tracking-tight">Controls</h2>
//         <div className="flex items-center space-x-2">
//           <Switch
//             id="show-selected"
//             checked={showSelected}
//             onCheckedChange={setShowSelected}
//           />
//           <Label htmlFor="show-selected">Show selected</Label>
//         </div>
//       </div>

//       {/* <Card className="p-6">
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
//           {levels.map((level, index) => (
//             <FilterSelect
//               key={level.value}
//               label={`L${index + 1}`}
//               options={billingAccounts}
//               value={filters[`l${index + 1}` as keyof typeof filters]}
//               onChange={(value) =>
//                 setFilters((prev) => ({
//                   ...prev,
//                   [`l${index + 1}`]: value,
//                 }))
//               }
//             />
//           ))}
//         </div>

//         <Separator className="my-6" />

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//           <FilterSelect
//             label="Billing Account Id"
//             options={billingAccounts}
//             value={filters.billingAccount}
//             onChange={(value) =>
//               setFilters((prev) => ({ ...prev, billingAccount: value }))
//             }
//           />
//         </div>
//       </Card> */}

//       <Card className="w-full max-w-xl p-5">
//         <Form {...form}>
//           <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
//             <FormField
//               control={form.control}
//               name="frameworks"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Frameworks</FormLabel>
//                   <FormControl>
//                     <MultiSelect
//                       options={frameworksList}
//                       onValueChange={field.onChange}
//                       defaultValue={field.value}
//                       placeholder="Select options"
//                       variant="secondary"
//                       animation={2}
//                       maxCount={2}
//                     />
//                   </FormControl>
//                   <FormDescription>
//                     Choose the frameworks you are interested in.
//                   </FormDescription>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />
//             <Button variant="outline" type="submit" className="w-full">
//               Submit
//             </Button>
//           </form>
//         </Form>
//       </Card>



//       {/* Preview Section */}
//       <Card className="p-6">
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//           <div>
//             <h3 className="font-medium mb-4">Selected Filters</h3>
//             <pre className="bg-muted p-4 rounded-lg text-sm">
//               {JSON.stringify(filters, null, 2)}
//             </pre>
//           </div>
//         </div>
//       </Card>
//     </div>
//   );
// }






import React, { createContext, useState, useContext, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../@/components/ui/card';
import { X } from 'lucide-react';
import { MultiSelect } from './multi-select'; // Update this import path
import { Bar, BarChart, Legend, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Label } from '../../@/components/ui/label';
import { Tooltip as ShadcnTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../@/components/ui/tooltip';
import AlertPage from '../custom-dashboard/AlertPage';

// Filter Context for Global State Management

interface FilterContextType {
  filters: Record<string, string[]>; // Object with string keys and string[] values
  clearFilter: (key: string) => void;
  clearAllFilters: () => void;
  updateFilter: (filterName: string, values: string[]) => void;
}

const FilterContext = React.createContext<FilterContextType | null>(null);

interface FilterValue {
  [key: string]: string[];
}

// Reusable Filter Data
const FILTER_OPTIONS = {
  city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'],
  district: ['Downtown', 'Midtown', 'Uptown', 'Suburbs', 'Industrial'],
  state: ['NY', 'CA', 'IL', 'TX', 'AZ'],
  country: ['USA', 'Canada', 'Mexico', 'UK', 'Australia']
};

// Utility function to generate chart data
const generateChartData = (filters: Record<string, string[]>) => ({
  salesData: [
    { name: 'Jan', [filters.city?.[0] || 'Default']: 400, [filters.district?.[0] || 'Default']: 240 },
    { name: 'Feb', [filters.city?.[0] || 'Default']: 300, [filters.district?.[0] || 'Default']: 139 },
    { name: 'Mar', [filters.city?.[0] || 'Default']: 200, [filters.district?.[0] || 'Default']: 980 },
  ],
  userGrowthData: [
    { name: 'Q1', [filters.state?.[0] || 'Default']: 4000, [filters.country?.[0] || 'Default']: 2400 },
    { name: 'Q2', [filters.state?.[0] || 'Default']: 3000, [filters.country?.[0] || 'Default']: 1398 },
    { name: 'Q3', [filters.state?.[0] || 'Default']: 2000, [filters.country?.[0] || 'Default']: 9800 },
  ],
  revenueData: [
    { name: 'Region', [filters.district?.[0] || 'Default']: 4000, [filters.city?.[0] || 'Default']: 2400 },
    { name: 'National', [filters.district?.[0] || 'Default']: 3000, [filters.city?.[0] || 'Default']: 1398 },
    { name: 'Global', [filters.district?.[0] || 'Default']: 2000, [filters.city?.[0] || 'Default']: 9800 },
  ]
});

// Global Filter Provider Component
const GlobalFilterProvider = ({ children }: { children: React.ReactNode }) => {
  const [filters, setFilters] = useState<Record<string, string[]>>({
    city: [],
    district: [],
    state: [],
    country: []
  });

  const updateFilter = (filterName: string, values: string[]) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: values
    }));
  };

  const clearFilter = (filterName: string) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: []
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      city: [],
      district: [],
      state: [],
      country: []
    });
  };

  return (
    <FilterContext.Provider value={{ filters, updateFilter, clearFilter, clearAllFilters }}>
      {children}
    </FilterContext.Provider>
  );
};

// Selected Filters Component
const SelectedFilters = () => {
  const context = useContext(FilterContext);
  if (!context) return null;
  const { filters, clearFilter, clearAllFilters } = context;

  const formatFilterValues = (key: string, values: string[]) => {
    const allOptions = FILTER_OPTIONS[key];
    
    // Show "All" if all values are selected
    if (values.length === allOptions.length) {
      return { displayText: 'All', tooltip: null };
    }
    
    // Show up to 3 values directly
    if (values.length <= 3) {
      return { displayText: values.join(', '), tooltip: null };
    }
    
    // Show first 2 values + count for remaining
    const displayValues = values.slice(0, 2);
    const remaining = values.slice(2);
    return {
      displayText: `${displayValues.join(', ')} +${remaining.length}`,
      tooltip: remaining.join(', ')
    };
  };

  const groupedFilters = Object.entries(filters)
    .filter(([_, values]) => values.length > 0)
    .map(([key, values]) => ({
      key: key.charAt(0).toUpperCase() + key.slice(1),
      ...formatFilterValues(key.toLowerCase(), values)
    }));

  if (groupedFilters.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded-lg p-2 mt-0 border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          Selected Filters
        </h3>
        <button 
          onClick={clearAllFilters}
          className="text-xs text-red-600 hover:text-red-800 flex items-center"
        >
          Clear All
          <X className="ml-1 h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {groupedFilters.map(({ key, displayText, tooltip }) => (
          <TooltipProvider key={key}>
            <div className="flex items-center bg-white border rounded-full px-3 py-1 text-sm shadow-sm">
              <span className="mr-2 text-gray-600 font-medium">
                {key}:
              </span>
              {tooltip ? (
                <ShadcnTooltip>
                  <TooltipTrigger className="text-gray-800 mr-2">
                    {displayText}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Also includes: {tooltip}</p>
                  </TooltipContent>
                </ShadcnTooltip>
              ) : (
                <span className="text-gray-800 mr-2">
                  {displayText}
                </span>
              )}
              <button 
                onClick={() => clearFilter(key.toLowerCase())}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
};

// Global Filter Component
const GlobalFilter = () => {
  const { filters, updateFilter } = useContext(FilterContext);
  const [isOpen, setIsOpen] = useState(false);

  const selectedFiltersCount: any = Object.values(filters).reduce((acc, curr: any) => acc + curr.length, 0);

  return (
    <div className="border rounded-lg shadow-sm">
      <div 
        className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-3">
          <span className="font-semibold text-gray-800">Global Filters</span>
          {selectedFiltersCount > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {selectedFiltersCount} Selected
            </span>
          )}
        </div>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`h-5 w-5 text-gray-600 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="p-4 border-t">
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(FILTER_OPTIONS).map(filterName => (
              <div key={filterName} className="w-full">
                <Label htmlFor={filterName} className="text-sm font-medium text-gray-600">
                  {filterName.charAt(0).toUpperCase() + filterName.slice(1)}
                </Label>
                <MultiSelect
                  options={FILTER_OPTIONS[filterName].map(option => ({ 
                    label: option, 
                    value: option 
                  }))}
                  onValueChange={(values) => updateFilter(filterName, values)}
                  defaultValue={filters[filterName]}
                  placeholder={`Select ${filterName.charAt(0).toUpperCase() + filterName.slice(1)}`}
                  maxCount={1}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {!isOpen && <SelectedFilters />}
    </div>
  );
};


// Reusable Chart Component
const FilteredBarChart = ({ 
  title, 
  data, 
  primaryKey, 
  secondaryKey 
}: { 
  title: string, 
  data: any[], 
  primaryKey: string, 
  secondaryKey: string 
}) => {
  const { filters } = useContext(FilterContext);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar 
              dataKey={filters[primaryKey]?.[0] || 'Default'} 
              fill="#8884d8" 
            />
            <Bar 
              dataKey={filters[secondaryKey]?.[0] || 'Default'} 
              fill="#82ca9d" 
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Main Dashboard Component
const GlobalFilterDashboard = () => {
  const { filters } = useContext(FilterContext);
  const chartData = generateChartData(filters);

  return (
    <div className="p-4 space-y-4">
      <GlobalFilter />
      
      <div className="grid grid-cols-3 gap-4">
        <FilteredBarChart 
          title="Sales Chart" 
          data={chartData.salesData}
          primaryKey="city"
          secondaryKey="district"
        />
        <FilteredBarChart 
          title="User Growth Chart" 
          data={chartData.userGrowthData}
          primaryKey="state"
          secondaryKey="country"
        />
        <FilteredBarChart 
          title="Revenue Chart" 
          data={chartData.revenueData}
          primaryKey="district"
          secondaryKey="city"
        />
      </div>
    </div>
  );
};

// Wrapper Component to Provide Context
const ChartWrapper = () => {
  return (
    <GlobalFilterProvider>
      <GlobalFilterDashboard />
      <AlertPage />
    </GlobalFilterProvider>
  );
};

export default ChartWrapper;