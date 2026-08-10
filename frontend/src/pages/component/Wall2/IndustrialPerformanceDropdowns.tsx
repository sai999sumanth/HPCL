// // // import type React from "react"
// // // import { FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent } from "@mui/material"

// // // interface DropdownProps {
// // //   label: string
// // //   value: string
// // //   options: string[]
// // //   onChange: (event: SelectChangeEvent<string>) => void
// // //   width?: string
// // // }

// // // const Dropdown: React.FC<DropdownProps> = ({ label, value, options, onChange, width = "100px" }) => (
// // //   <FormControl size="small">
// // //     <InputLabel id={`${label.toLowerCase()}-select-label`} className="text-gray-600">
// // //       {label}
// // //     </InputLabel>
// // //     <Select
// // //       labelId={`${label.toLowerCase()}-select-label`}
// // //       id={`${label.toLowerCase()}-select`}
// // //       value={value}
// // //       label={label}
// // //       onChange={onChange}
// // //       className={`w-[${width}] bg-white text-gray-800 border-gray-300`}
// // //     >
// // //       <MenuItem value="_empty">All</MenuItem>
// // //       {options.map((option) => (
// // //         <MenuItem key={option} value={option}>
// // //           {option}
// // //         </MenuItem>
// // //       ))}
// // //     </Select>
// // //   </FormControl>
// // // )

// // // interface SalesDropdownsProps {
// // //   selectedYear: string
// // //   selectedSBU: string
// // //   selectedZone: string
// // //   selectedRegion: string
// // //   selectedSalesArea: string
// // //   selectedProductName: string
// // //   yearOptions: string[]
// // //   sbuOptions: string[]
// // //   zoneOptions: string[]
// // //   regionOptions: string[]
// // //   salesAreaOptions: string[]
// // //   productOptions: string[]
// // //   handleYearChange: (event: SelectChangeEvent<string>) => void
// // //   handleSBUChange: (event: SelectChangeEvent<string>) => void
// // //   handleZoneChange: (event: SelectChangeEvent<string>) => void
// // //   handleRegionChange: (event: SelectChangeEvent<string>) => void
// // //   handleSalesAreaChange: (event: SelectChangeEvent<string>) => void
// // //   handleProductNameChange: (event: SelectChangeEvent<string>) => void
// // //   mode: string
// // // }

// // // export const SalesDropdowns: React.FC<SalesDropdownsProps> = ({
// // //   selectedYear,
// // //   selectedSBU,
// // //   selectedZone,
// // //   selectedRegion,
// // //   selectedSalesArea,
// // //   selectedProductName,
// // //   yearOptions,
// // //   sbuOptions,
// // //   zoneOptions,
// // //   regionOptions,
// // //   salesAreaOptions,
// // //   productOptions,
// // //   handleYearChange,
// // //   handleSBUChange,
// // //   handleZoneChange,
// // //   handleRegionChange,
// // //   handleSalesAreaChange,
// // //   handleProductNameChange,
// // //   mode,
// // // }) => {
// // //   return (
// // //     <div className="flex ml-[-0.5rem] mt-1 flex-wrap gap-2 items-center">
// // //       {mode === "year" && (
// // //         <Dropdown label="Year" value={selectedYear} options={yearOptions} onChange={handleYearChange} width="80px"/>
// // //       )}
// // //       <Dropdown label="SBU" value={selectedSBU} options={sbuOptions} onChange={handleSBUChange}  width="80px" />
// // //       <Dropdown label="Zone" value={selectedZone} options={zoneOptions} onChange={handleZoneChange} width="80px" />
// // //       <Dropdown label="Region" value={selectedRegion} options={regionOptions} onChange={handleRegionChange} width="80px" />
// // //       <Dropdown
// // //         label="Sales Area"
// // //         value={selectedSalesArea}
// // //         options={salesAreaOptions}
// // //         onChange={handleSalesAreaChange}
// // //         width="100px"
// // //       />
// // //       <Dropdown
// // //         label="Product Name"
// // //         value={selectedProductName}
// // //         options={productOptions}
// // //         onChange={handleProductNameChange}
// // //         width="120px"
// // //       />
// // //     </div>
// // //   )
// // // }
// // 'use client'

// // import * as React from "react"
// // import {
// //   Select,
// //   SelectContent,
// //   SelectItem,
// //   SelectTrigger,
// //   SelectValue,
// // } from "@/@/components/ui/select"

// // interface DropdownProps {
// //   label: string
// //   value: string
// //   options: string[]
// //   onChange: (value: string) => void
// //   width?: string
// // }

// // const Dropdown: React.FC<DropdownProps> = ({ label, value, options, onChange, width = "100px" }) => (
// //   <Select value={value} onValueChange={onChange}>
// //     <SelectTrigger className={`w-[${width}]`}>
// //       <SelectValue placeholder={label} />
// //     </SelectTrigger>
// //     <SelectContent>
// //       <SelectItem value="_empty">All</SelectItem>
// //       {options.map((option) => (
// //         <SelectItem key={option} value={option}>
// //           {option}
// //         </SelectItem>
// //       ))}
// //     </SelectContent>
// //   </Select>
// // )

// // interface SalesDropdownsProps {
// //   selectedYear: string
// //   selectedSBU: string
// //   selectedZone: string
// //   selectedRegion: string
// //   selectedSalesArea: string
// //   selectedProductName: string
// //   yearOptions: string[]
// //   sbuOptions: string[]
// //   zoneOptions: string[]
// //   regionOptions: string[]
// //   salesAreaOptions: string[]
// //   productOptions: string[]
// //   handleYearChange: (value: string) => void
// //   handleSBUChange: (value: string) => void
// //   handleZoneChange: (value: string) => void
// //   handleRegionChange: (value: string) => void
// //   handleSalesAreaChange: (value: string) => void
// //   handleProductNameChange: (value: string) => void
// //   mode: string
// // }

// // export const SalesDropdowns: React.FC<SalesDropdownsProps> = ({
// //   selectedYear,
// //   selectedSBU,
// //   selectedZone,
// //   selectedRegion,
// //   selectedSalesArea,
// //   selectedProductName,
// //   yearOptions,
// //   sbuOptions,
// //   zoneOptions,
// //   regionOptions,
// //   salesAreaOptions,
// //   productOptions,
// //   handleYearChange,
// //   handleSBUChange,
// //   handleZoneChange,
// //   handleRegionChange,
// //   handleSalesAreaChange,
// //   handleProductNameChange,
// //   mode,
// // }) => {
// //   return (
// //     <div className="flex ml-[-0.5rem] mt-1 flex-wrap gap-2 items-center">
// //       {mode === "year" && (
// //         <Dropdown label="Year" value={selectedYear} options={yearOptions} onChange={handleYearChange} width="80px"/>
// //       )}
// //       <Dropdown label="SBU" value={selectedSBU} options={sbuOptions} onChange={handleSBUChange}  width="80px" />
// //       <Dropdown label="Zone" value={selectedZone} options={zoneOptions} onChange={handleZoneChange} width="80px" />
// //       <Dropdown label="Region" value={selectedRegion} options={regionOptions} onChange={handleRegionChange} width="80px" />
// //       <Dropdown
// //         label="Sales Area"
// //         value={selectedSalesArea}
// //         options={salesAreaOptions}
// //         onChange={handleSalesAreaChange}
// //         width="100px"
// //       />
// //       <Dropdown
// //         label="Product Name"
// //         value={selectedProductName}
// //         options={productOptions}
// //         onChange={handleProductNameChange}
// //         width="120px"
// //       />
// //     </div>
// //   )
// // }
// 'use client'

// import * as React from "react"
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/@/components/ui/select"

// interface DropdownProps {
//   label: string
//   value: string
//   options: string[]
//   onChange: (value: string) => void
//   width?: string
// }

// const Dropdown: React.FC<DropdownProps> = ({ label, value, options, onChange, width = "100px" }) => (
//   <Select value={value} onValueChange={onChange}>
//     <SelectTrigger className={`h-7.5 min-h-8 text-xs px-2 py-0`} style={{ width }}>
//       <SelectValue placeholder={label} />
//     </SelectTrigger>
//     <SelectContent>
//       <SelectItem value="_empty" className="h-7 py-0 text-xs">All</SelectItem>
//       {options.map((option) => (
//         <SelectItem key={option} value={option} className="h-7 py-0 text-xs">
//           {option}
//         </SelectItem>
//       ))}
//     </SelectContent>
//   </Select>
// )

// interface SalesDropdownsProps {
//   selectedYear: string
//   selectedSBU: string
//   selectedZone: string
//   selectedRegion: string
//   selectedSalesArea: string
//   selectedProductName: string
//   yearOptions: string[]
//   sbuOptions: string[]
//   zoneOptions: string[]
//   regionOptions: string[]
//   salesAreaOptions: string[]
//   productOptions: string[]
//   handleYearChange: (value: string) => void
//   handleSBUChange: (value: string) => void
//   handleZoneChange: (value: string) => void
//   handleRegionChange: (value: string) => void
//   handleSalesAreaChange: (value: string) => void
//   handleProductNameChange: (value: string) => void
//   mode: string
// }

// export const SalesDropdowns: React.FC<SalesDropdownsProps> = ({
//   selectedYear,
//   selectedSBU,
//   selectedZone,
//   selectedRegion,
//   selectedSalesArea,
//   selectedProductName,
//   yearOptions,
//   sbuOptions,
//   zoneOptions,
//   regionOptions,
//   salesAreaOptions,
//   productOptions,
//   handleYearChange,
//   handleSBUChange,
//   handleZoneChange,
//   handleRegionChange,
//   handleSalesAreaChange,
//   handleProductNameChange,
//   mode,
// }) => {
//   return (
//     <div className="flex text-xs flex-wrap gap-2 items-center">
//       {mode === "year" && (
//         <Dropdown label="Year" value={selectedYear} options={yearOptions} onChange={handleYearChange} width="80px"/>
//       )}
//       <Dropdown label="SBU" value={selectedSBU} options={sbuOptions} onChange={handleSBUChange} width="80px" />
//       <Dropdown label="Zone" value={selectedZone} options={zoneOptions} onChange={handleZoneChange} width="80px" />
//       <Dropdown label="Region" value={selectedRegion} options={regionOptions} onChange={handleRegionChange} width="80px" />
//       <Dropdown
//         label="Sales Area"
//         value={selectedSalesArea}
//         options={salesAreaOptions}
//         onChange={handleSalesAreaChange}
//         width="100px"
//       />
//       <Dropdown
//         label="Product Name"
//         value={selectedProductName}
//         options={productOptions}
//         onChange={handleProductNameChange}
//         width="120px"
//       />
//     </div>
//   )
// }
// 'use client'

// import * as React from "react"
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/@/components/ui/select"
// import { Search } from "lucide-react"
// import { Separator } from "@/@/components/ui/separator"

// interface DropdownProps {
//   label: string
//   value: string
//   options: string[]
//   onChange: (value: string) => void
//   width?: string
// }

// const Dropdown: React.FC<DropdownProps> = ({ label, value, options = [], onChange, width = "100px" }) => {
//   const [searchQuery, setSearchQuery] = React.useState("")
//   const [open, setOpen] = React.useState(false)

//   const filteredOptions = React.useMemo(() => {
//     return options.filter(option => 
//       option && typeof option === 'string' && 
//       option.toLowerCase().includes(searchQuery.toLowerCase())
//     )
//   }, [options, searchQuery])

//   const handleValueChange = (newValue: string) => {
//     onChange(newValue)
//     setSearchQuery("")
//   }

//   return (
//     <Select 
//       value={value} 
//       onValueChange={handleValueChange}
//       open={open}
//       onOpenChange={setOpen}
//     >
//       <SelectTrigger className={`h-7.5 min-h-8 text-xs px-2 py-0`} style={{ width }}>
//         <SelectValue placeholder={label} />
//       </SelectTrigger>
//       <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
//         <div className="flex items-center px-2 pb-2 sticky top-0 bg-white">
//           <Search className="w-4 h-4 text-gray-500" />

//           <input
//             className="flex w-full border-0 p-2 text-xs bg-transparent outline-none placeholder:text-gray-500"
//             placeholder="Search..."
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             onClick={(e) => e.stopPropagation()}
//           />

//         </div>
//         <SelectItem value="_empty" className="h-7 py-0 text-xs">All</SelectItem>
//         {filteredOptions.map((option) => (
//           option && (
//             <SelectItem key={option} value={option} className="h-7 py-0 text-xs">
//               {option}
//             </SelectItem>
//           )
//         ))}
//         {filteredOptions.length === 0 && (
//           <div className="text-xs text-gray-500 p-2">No results found</div>
//         )}
//       </SelectContent>
//     </Select>
//   )
// }

// interface SalesDropdownsProps {
//   selectedYear: string
//   selectedSBU: string
//   selectedZone: string
//   selectedRegion: string
//   selectedSalesArea: string
//   selectedProductName: string
//   yearOptions: string[]
//   sbuOptions: string[]
//   zoneOptions: string[]
//   regionOptions: string[]
//   salesAreaOptions: string[]
//   productOptions: string[]
//   handleYearChange: (value: string) => void
//   handleSBUChange: (value: string) => void
//   handleZoneChange: (value: string) => void
//   handleRegionChange: (value: string) => void
//   handleSalesAreaChange: (value: string) => void
//   handleProductNameChange: (value: string) => void
//   mode: string
// }

// export const SalesDropdowns: React.FC<SalesDropdownsProps> = ({
//   selectedYear,
//   selectedSBU,
//   selectedZone,
//   selectedRegion,
//   selectedSalesArea,
//   selectedProductName,
//   yearOptions = [],
//   sbuOptions = [],
//   zoneOptions = [],
//   regionOptions = [],
//   salesAreaOptions = [],
//   productOptions = [],
//   handleYearChange,
//   handleSBUChange,
//   handleZoneChange,
//   handleRegionChange,
//   handleSalesAreaChange,
//   handleProductNameChange,
//   mode,
// }) => {
//   return (
//     <div className="flex text-xs flex-wrap gap-2 items-center">
//       {mode === "year" && (
//         <Dropdown label="Year" value={selectedYear} options={yearOptions} onChange={handleYearChange} width="80px"/>
//       )}
//       <Dropdown label="SBU" value={selectedSBU} options={sbuOptions} onChange={handleSBUChange} width="80px" />
//       <Dropdown label="Zone" value={selectedZone} options={zoneOptions} onChange={handleZoneChange} width="80px" />
//       <Dropdown label="Region" value={selectedRegion} options={regionOptions} onChange={handleRegionChange} width="80px" />
//       <Dropdown
//         label="Sales Area"
//         value={selectedSalesArea}
//         options={salesAreaOptions}
//         onChange={handleSalesAreaChange}
//         width="100px"
//       />
//       <Dropdown
//         label="Product Name"
//         value={selectedProductName}
//         options={productOptions}
//         onChange={handleProductNameChange}
//         width="120px"
//       />
//     </div>
//   )
// }
import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select"
import { Search } from "lucide-react"

interface DropdownProps {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  width?: string
}

const Dropdown: React.FC<DropdownProps> = ({ 
  label, 
  value, 
  options = [], 
  onChange, 
  width = "100px"
}) => {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)

  const filteredOptions = React.useMemo(() => {
    return options.filter(option => 
      option && typeof option === 'string' && 
      option.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [options, searchQuery])

  const handleValueChange = (newValue: string) => {
    onChange(newValue)
    setSearchQuery("")
  }

  return (
    <Select 
      value={value} 
      onValueChange={handleValueChange}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger 
        className="h-7.5 min-h-8 text-xs px-2 py-0"
        style={{ width }}
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center px-2 pb-2 sticky top-0 bg-white">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            className="flex w-full border-0 p-2 text-xs bg-transparent outline-none placeholder:text-gray-500"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <SelectItem value="_empty" className="h-7 py-0 text-xs">All</SelectItem>
        {filteredOptions.map((option) => (
          option && (
            <SelectItem key={option} value={option} className="h-7 py-0 text-xs">
              {option}
            </SelectItem>
          )
        ))}
        {filteredOptions.length === 0 && (
          <div className="text-xs text-gray-500 p-2">No results found</div>
        )}
      </SelectContent>
    </Select>
  )
}

interface IndustrialPerformanceDropdownsProps {
  selectedYear?: string
  selectedSBU?: string
  selectedZone?: string
  selectedRegion?: string
  selectedSalesArea?: string
  selectedProductName?: string
  yearOptions?: string[]
  sbuOptions?: string[]
  zoneOptions?: string[]
  regionOptions?: string[]
  salesAreaOptions?: string[]
  productOptions?: string[]
  handleYearChange?: (key: string, value: string) => void
  handleSBUChange?: (key: string, value: string) => void
  handleZoneChange?: (key: string, value: string) => void
  handleRegionChange?: (key: string, value: string) => void
  handleSalesAreaChange?: (key: string, value: string) => void
  handleProductNameChange?: (key: string, value: string) => void
  mode: string
}

export const IndustrialPerformanceDropdowns: React.FC<IndustrialPerformanceDropdownsProps> = ({
  selectedYear,
  selectedSBU,
  selectedZone,
  selectedRegion,
  selectedSalesArea,
  selectedProductName,
  yearOptions = [],
  sbuOptions = [],
  zoneOptions = [],
  regionOptions = [],
  salesAreaOptions = [],
  productOptions = [],
  handleYearChange,
  handleSBUChange,
  handleZoneChange,
  handleRegionChange,
  handleSalesAreaChange,
  handleProductNameChange,
  mode,
}) => {
  // Define the order of filters for hierarchy
  const filterOrder = ['year', 'sbu', 'zone', 'region', 'salesArea', 'product']

  //
  const omcOptions = ["PVT", "MPSU", "Other PSU","PSU","BPCL","IOCL"];
  const [selectedOMC, setSelectedOMC] = React.useState("");
  const handleOmcChange = (value: string) => {
    setSelectedOMC(value);
  }

  // Enhanced change handlers that reset subsequent dropdowns
  const handleChange = (key: string, value: string) => {
    const keyIndex = filterOrder.indexOf(key)
    
    // Call the appropriate handler
    switch (key) {
      case 'year':
        handleYearChange(key, value)
        // Reset subsequent dropdowns if not "All"
        if (value === '_empty') {
          handleSBUChange(key, '_empty')
          handleZoneChange(key, '_empty')
          handleRegionChange(key, '_empty')
          handleSalesAreaChange(key, '_empty')
          handleProductNameChange(key, '_empty')
        }
        break
      case 'sbu':
        if (value === '_empty') {
          handleZoneChange(key, '_empty')
          handleRegionChange(key, '_empty')
          handleSalesAreaChange(key, '_empty')
          handleProductNameChange(key, '_empty')
        }
        handleSBUChange(key, value)
        break
      case 'zone':
        handleZoneChange(key, value)
        if (value === '_empty') {
          handleRegionChange(key, '_empty')
          handleSalesAreaChange(key, '_empty')
          handleProductNameChange(key, '_empty')
        }
        break
      case 'region':
        handleRegionChange(key, value)
        if (value === '_empty') {
          handleSalesAreaChange(key, '_empty')
          handleProductNameChange(key, '_empty')
        }
        break
      case 'salesArea':
        handleSalesAreaChange(key, value)
        if (value === '_empty') {
          handleProductNameChange(key, '_empty')
        }
        break
      case 'product':
        handleProductNameChange(key, value)
        break
    }
  }

  return (
    <div className="flex text-xs flex-wrap gap-2 items-center">
      {mode === "year" && (
        <Dropdown 
          label="Year" 
          value={selectedYear} 
          options={yearOptions} 
          onChange={(value) => handleChange('year', value)} 
          width="80px"
        />
      )}
      <Dropdown 
        label="OMC" 
        value={selectedOMC} 
        options={omcOptions} 
        onChange={(value) => handleOmcChange( value)} 
        width="80px"
      />
      <Dropdown 
        label="SBU" 
        value={selectedSBU} 
        options={sbuOptions} 
        onChange={(value) => handleChange('sbu', value)} 
        width="80px"
      />
      <Dropdown 
        label="Region" 
        value={selectedRegion} 
        options={regionOptions} 
        onChange={(value) => handleChange('region', value)} 
        width="80px"
      />
      <Dropdown 
        label="State" 
        value={selectedZone} 
        options={zoneOptions} 
        onChange={(value) => handleChange('zone', value)} 
        width="80px"
      />
      
      <Dropdown
        label="District"
        value={selectedSalesArea}
        options={salesAreaOptions}
        onChange={(value) => handleChange('salesArea', value)}
        width="100px"
      />
      <Dropdown
        label="Product Name"
        value={selectedProductName}
        options={productOptions}
        onChange={(value) => handleChange('product', value)}
        width="120px"
      />
    </div>
  )
}





export const RetailSalesDropdowns: React.FC<IndustrialPerformanceDropdownsProps> = ({
  selectedYear,
  selectedSBU,
  selectedZone,
  selectedRegion,
  selectedSalesArea,
  selectedProductName,
  yearOptions = [],
  sbuOptions = [],
  zoneOptions = [],
  regionOptions = [],
  salesAreaOptions = [],
  productOptions = [],
  handleYearChange,
  handleSBUChange,
  handleZoneChange,
  handleRegionChange,
  handleSalesAreaChange,
  handleProductNameChange,
  mode,
}) => {
  // Define the order of filters for hierarchy
  const filterOrder = ['year', 'sbu', 'zone', 'region', 'salesArea', 'product']

  // Enhanced change handlers that reset subsequent dropdowns
  const handleChange = (key: string, value: string) => {
    const keyIndex = filterOrder.indexOf(key)
    
    // Call the appropriate handler
    switch (key) {
      case 'year':
        handleYearChange(key, value)
        // Reset subsequent dropdowns if not "All"
        if (value === '_empty') {
          handleSBUChange(key, '_empty')
          handleZoneChange(key, '_empty')
          handleRegionChange(key, '_empty')
          handleSalesAreaChange(key, '_empty')
          handleProductNameChange(key, '_empty')
        }
        break
      case 'sbu':
        if (value === '_empty') {
          handleZoneChange(key, '_empty')
          handleRegionChange(key, '_empty')
          handleSalesAreaChange(key, '_empty')
          handleProductNameChange(key, '_empty')
        }
        handleSBUChange(key, value)
        break
      case 'zone':
        handleZoneChange(key, value)
        if (value === '_empty') {
          handleRegionChange(key, '_empty')
          handleSalesAreaChange(key, '_empty')
          handleProductNameChange(key, '_empty')
        }
        break
      case 'region':
        handleRegionChange(key, value)
        if (value === '_empty') {
          handleSalesAreaChange(key, '_empty')
          handleProductNameChange(key, '_empty')
        }
        break
      case 'salesArea':
        handleSalesAreaChange(key, value)
        if (value === '_empty') {
          handleProductNameChange(key, '_empty')
        }
        break
      case 'product':
        handleProductNameChange(key, value)
        break
    }
  }

  return (
    <div className="flex text-xs flex-wrap gap-2 items-center">
      {mode === "year" && (
        <Dropdown 
          label="Year" 
          value={selectedYear} 
          options={yearOptions} 
          onChange={(value) => handleChange('year', value)} 
          width="80px"
        />
      )}
    
      <Dropdown 
        label="Zone" 
        value={selectedZone} 
        options={zoneOptions} 
        onChange={(value) => handleChange('zone', value)} 
        width="80px"
      />
      <Dropdown 
        label="Region" 
        value={selectedRegion} 
        options={regionOptions} 
        onChange={(value) => handleChange('region', value)} 
        width="80px"
      />
      <Dropdown
        label="Sales Area"
        value={selectedSalesArea}
        options={salesAreaOptions}
        onChange={(value) => handleChange('salesArea', value)}
        width="100px"
      />
      <Dropdown
        label="Product Name"
        value={selectedProductName}
        options={productOptions}
        onChange={(value) => handleChange('product', value)}
        width="120px"
      />
    </div>
  )
}