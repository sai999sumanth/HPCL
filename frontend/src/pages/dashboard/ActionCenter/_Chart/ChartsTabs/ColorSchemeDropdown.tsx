// import React from 'react';
// import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem, SelectLabel } from '../../../../../@/components/ui/select';
// import { ChevronDownIcon } from '@heroicons/react/20/solid';

// const colorSchemes = [
//   { name: 'Superset Colors', colors: [    
//     '#1FA8C9',
//     '#454E7C',
//     '#5AC189',
//     '#FF7F44',
//     '#666666',
//     '#E04355',
//     '#FCC700',
//     '#A868B7',
//     '#3CCCCB',
//     '#A38F79',
//     // Pastels
//     '#8FD3E4',
//     '#A1A6BD',
//     '#ACE1C4',
//     '#FEC0A1',
//     '#B2B2B2',
//     '#EFA1AA',
//     '#FDE380',
//     '#D3B3DA',
//     '#9EE5E5',
//     '#D1C6BC',
// ] },
//   { name: 'Airbnb Colors', colors: [
//     '#29696B',
//       '#5BCACE',
//       '#F4B02A',
//       '#F1826A',
//       '#792EB2',
//       '#C96EC6',
//       '#921E50',
//       '#B27700',
//       '#9C3498',
//       '#9C3498',
//       '#E4679D',
//       '#C32F0E',
//       '#9D63CA',] },
//   { name: 'D3 Category 10', colors: [
//       '#1f77b4',
//       '#ff7f0e',
//       '#2ca02c',
//       '#d62728',
//       '#9467bd',
//       '#8c564b',
//       '#e377c2',
//       '#7f7f7f',
//       '#bcbd22',
//       '#17becf',] },
//   { name: 'colorsOfRainbow', colors: [
//       '#41ED86',
//       '#2FC096',
//       '#01DFFF',
//       '#153AE0',
//       '#850AD6',
//       '#BD59FF',
//       '#FF4A96',
//       '#C32668',
//       '#F40000',
//       '#FF8901',
//       '#FFBC0A',
//       '#FFEC43',] },
//   { name: 'D3 Category 20', colors: ['#1f77b4',
//       '#aec7e8',
//       '#ff7f0e',
//       '#ffbb78',
//       '#2ca02c',
//       '#98df8a',
//       '#d62728',
//       '#ff9896',
//       '#9467bd',
//       '#c5b0d5',
//       '#8c564b',
//       '#c49c94',
//       '#e377c2',
//       '#f7b6d2',
//       '#7f7f7f',
//       '#c7c7c7',
//       '#bcbd22',
//       '#dbdb8d',
//       '#17becf',
//       '#9edae5',] },
//   { name: 'D3 Category 20b', colors: ['#393b79',
//       '#5254a3',
//       '#6b6ecf',
//       '#9c9ede',
//       '#637939',
//       '#8ca252',
//       '#b5cf6b',
//       '#cedb9c',
//       '#8c6d31',
//       '#bd9e39',
//       '#e7ba52',
//       '#e7cb94',
//       '#843c39',
//       '#ad494a',
//       '#d6616b',
//       '#e7969c',
//       '#7b4173',
//       '#a55194',
//       '#ce6dbd',
//       '#de9ed6',] },
//   { name: 'D3 Category 20c', colors: [ '#3182bd',
//     '#6baed6',
//     '#9ecae1',
//     '#c6dbef',
//     '#e6550d',
//     '#fd8d3c',
//     '#fdae6b',
//     '#fdd0a2',
//     '#31a354',
//     '#74c476',
//     '#a1d99b',
//     '#c7e9c0',
//     '#756bb1',
//     '#9e9ac8',
//     '#bcbddc',
//     '#dadaeb',
//     '#636363',
//     '#969696',
//     '#bdbdbd',
//     '#d9d9d9',] },
//   { name: 'ECharts v5.x Colors', colors: [ '#5470C6',
//     '#91CC75',
//     '#FAC858',
//     '#EE6666',
//     '#73C0DE',
//     '#3BA272',
//     '#FC8452',
//     '#9A60B4',
//     '#EA7CCC',] },
//   { name: 'ECharts v4.x Colors', colors: [ '#c23531',
//     '#2f4554',
//     '#61a0a8',
//     '#d48265',
//     '#91c7ae',
//     '#749f83',
//     '#ca8622',
//     '#bda29a',
//     '#6e7074',
//     '#546570',
//     '#c4ccd3',] },
//   { name: 'Google Category 20c', colors: [ '#3366cc',
//     '#dc3912',
//     '#ff9900',
//     '#109618',
//     '#990099',
//     '#0099c6',
//     '#dd4477',
//     '#66aa00',
//     '#b82e2e',
//     '#316395',
//     '#994499',
//     '#22aa99',
//     '#aaaa11',
//     '#6633cc',
//     '#e67300',
//     '#8b0707',
//     '#651067',
//     '#329262',
//     '#5574a6',
//     '#3b3eac',] },
//   { name: 'lyftColors', colors: [ '#EA0B8C',
//     '#6C838E',
//     '#29ABE2',
//     '#33D9C1',
//     '#9DACB9',
//     '#7560AA',
//     '#2D5584',
//     '#831C4A',
//     '#333D47',
//     '#AC2077',] },
//   { name: 'Modern sunset', colors: ['#0080F6',
//       '#254081',
//       '#6C4592',
//       '#A94693',
//       '#DC4180',
//       '#F35193',
//       '#FF7582',
//       '#FF4C5D',
//       '#FF824E',
//       '#FFAD2A',
//       '#FFDB04',
//       '#F3F700',] },
//   { name: 'presetColors', colors: [ '#6BD3B3',
//     '#FCC550',
//     '#408184',
//     '#66CBE2',
//     '#EE5960',
//     '#484E5A',
//     '#FF874E',
//     '#03748E',
//     '#C9BBAB',
//     '#B17BAA',
//     // Pastels
//     '#B5E9D9',
//     '#FDE2A7',
//     '#9FC0C1',
//     '#B2E5F0',
//     '#F6ACAF',
//     '#A4A6AC',
//     '#FFC3A6',
//     '#81B9C6',
//     '#E4DDD5',
//     '#D9BDD5',] },
//   { name: 'Preset + Superset', colors: [ '#004960',
//     '#2893B3',
//     '#20A7C9',
//     '#5CC0DA',
//     '#7DCDE1',
//     '#A9D3E1',
//     '#C6ECE1',
//     '#AAE2D2',
//     '#71CFB4',
//     '#2FC096',
//     '#178F7A',
//     '#067162',] },
//   { name: 'Red to yellow', colors: [ '#90042A',
//     '#D60039',
//     '#D1353B',
//     '#E45233',
//     '#F47028',
//     '#FE8E17',
//     '#FFAD00',
//     '#FFCC00',
//     '#FFE601',
//     '#FFF46D',] },

//   { name: 'Waves of blue', colors: [ '#070061',
//     '#0A0095',
//     '#0054B4',
//     '#006BE7',
//     '#2289FF',
//     '#4A9FFF',
//     '#76B6FF',
//     '#9DCBFF',
//     '#BEDCFF',
//     '#DAEBFF',] },

//   { name: 'blueToGreen', colors: ['#3200A7',
//       '#004CDA',
//       '#0074F1',
//       '#0096EF',
//       '#53BFFF',
//       '#41C8E6',
//       '#30DEDE',
//       '#04D9C7',
//       '#00EAA2',
//       '#A6FF93',] },

//   // Add more color schemes as needed
// ];

// const ColorSchemeDropdown: React.FC = () => {
//   const [selectedScheme, setSelectedScheme] = React.useState(colorSchemes[0].name);

//   const handleChange = (value: string) => {
//     setSelectedScheme(value);
//   };

//   const getColorSchemeByName = (name: string) => {
//     return colorSchemes.find((scheme) => scheme.name === name);
//   };

//   const selectedColors = getColorSchemeByName(selectedScheme)?.colors ?? [];

//   return (
//     <Select value={selectedScheme} onValueChange={handleChange}>
//       <SelectTrigger>
//         <div className="flex justify-between items-center w-full">
//           <SelectValue placeholder="Select a Color Scheme" />
//           <div className="flex gap-1 ml-2">
//             {selectedColors.map((color, index) => (
//               <div
//                 key={index}
//                 className="w-4 h-4"
//                 style={{ backgroundColor: color }}
//               />
//             ))}
//           </div>
//           <ChevronDownIcon className="ml-2 w-5 h-5" />
//         </div>
//       </SelectTrigger>
//       <SelectContent>
//         <SelectGroup>
//           <SelectLabel>Color Schemes</SelectLabel>
//           {colorSchemes.map((scheme, index) => (
//             <SelectItem key={index} value={scheme.name}>
//               <div className="flex justify-between items-center">
//                 <span>{scheme.name}</span>
//                 <div className="flex gap-1 ml-2">
//                   {scheme.colors.map((color, idx) => (
//                     <div
//                       key={idx}
//                       className="w-4 h-4"
//                       style={{ backgroundColor: color }}
//                     />
//                   ))}
//                 </div>
//               </div>
//             </SelectItem>
//           ))}
//         </SelectGroup>
//       </SelectContent>
//     </Select>
//   );
// };

// export default ColorSchemeDropdown;
import React, { useState } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
} from '../../../../../@/components/ui/select';
interface ColorSchemeDropdownProps {
    onColorSchemeChange: (schemeName: string) => void;
  }
  
 
export const colorSchemes = [
    { name: 'Superset Colors', colors: [    
      '#1FA8C9',
      '#454E7C',
      '#5AC189',
      '#FF7F44',
      '#666666',
      '#E04355',
      '#FCC700',
      '#A868B7',
      '#3CCCCB',
      '#A38F79',
      // Pastels
      '#8FD3E4',
      '#A1A6BD',
      '#ACE1C4',
      '#FEC0A1',
      '#B2B2B2',
      '#EFA1AA',
      '#FDE380',
      '#D3B3DA',
      '#9EE5E5',
      '#D1C6BC',
  ] },
    { name: 'Airbnb Colors', colors: [
      '#29696B',
        '#5BCACE',
        '#F4B02A',
        '#F1826A',
        '#792EB2',
        '#C96EC6',
        '#921E50',
        '#B27700',
        '#9C3498',
        '#9C3498',
        '#E4679D',
        '#C32F0E',
        '#9D63CA',] },
    { name: 'D3 Category 10', colors: [
        '#1f77b4',
        '#ff7f0e',
        '#2ca02c',
        '#d62728',
        '#9467bd',
        '#8c564b',
        '#e377c2',
        '#7f7f7f',
        '#bcbd22',
        '#17becf',] },
    { name: 'colorsOfRainbow', colors: [
        '#41ED86',
        '#2FC096',
        '#01DFFF',
        '#153AE0',
        '#850AD6',
        '#BD59FF',
        '#FF4A96',
        '#C32668',
        '#F40000',
        '#FF8901',
        '#FFBC0A',
        '#FFEC43',] },
    { name: 'D3 Category 20', colors: ['#1f77b4',
        '#aec7e8',
        '#ff7f0e',
        '#ffbb78',
        '#2ca02c',
        '#98df8a',
        '#d62728',
        '#ff9896',
        '#9467bd',
        '#c5b0d5',
        '#8c564b',
        '#c49c94',
        '#e377c2',
        '#f7b6d2',
        '#7f7f7f',
        '#c7c7c7',
        '#bcbd22',
        '#dbdb8d',
        '#17becf',
        '#9edae5',] },
    { name: 'D3 Category 20b', colors: ['#393b79',
        '#5254a3',
        '#6b6ecf',
        '#9c9ede',
        '#637939',
        '#8ca252',
        '#b5cf6b',
        '#cedb9c',
        '#8c6d31',
        '#bd9e39',
        '#e7ba52',
        '#e7cb94',
        '#843c39',
        '#ad494a',
        '#d6616b',
        '#e7969c',
        '#7b4173',
        '#a55194',
        '#ce6dbd',
        '#de9ed6',] },
    { name: 'D3 Category 20c', colors: [ '#3182bd',
      '#6baed6',
      '#9ecae1',
      '#c6dbef',
      '#e6550d',
      '#fd8d3c',
      '#fdae6b',
      '#fdd0a2',
      '#31a354',
      '#74c476',
      '#a1d99b',
      '#c7e9c0',
      '#756bb1',
      '#9e9ac8',
      '#bcbddc',
      '#dadaeb',
      '#636363',
      '#969696',
      '#bdbdbd',
      '#d9d9d9',] },
    { name: 'ECharts v5.x Colors', colors: [ '#5470C6',
      '#91CC75',
      '#FAC858',
      '#EE6666',
      '#73C0DE',
      '#3BA272',
      '#FC8452',
      '#9A60B4',
      '#EA7CCC',] },
    { name: 'ECharts v4.x Colors', colors: [ '#c23531',
      '#2f4554',
      '#61a0a8',
      '#d48265',
      '#91c7ae',
      '#749f83',
      '#ca8622',
      '#bda29a',
      '#6e7074',
      '#546570',
      '#c4ccd3',] },
    { name: 'Google Category 20c', colors: [ '#3366cc',
      '#dc3912',
      '#ff9900',
      '#109618',
      '#990099',
      '#0099c6',
      '#dd4477',
      '#66aa00',
      '#b82e2e',
      '#316395',
      '#994499',
      '#22aa99',
      '#aaaa11',
      '#6633cc',
      '#e67300',
      '#8b0707',
      '#651067',
      '#329262',
      '#5574a6',
      '#3b3eac',] },
    { name: 'lyftColors', colors: [ '#EA0B8C',
      '#6C838E',
      '#29ABE2',
      '#33D9C1',
      '#9DACB9',
      '#7560AA',
      '#2D5584',
      '#831C4A',
      '#333D47',
      '#AC2077',] },
    { name: 'Modern sunset', colors: ['#0080F6',
        '#254081',
        '#6C4592',
        '#A94693',
        '#DC4180',
        '#F35193',
        '#FF7582',
        '#FF4C5D',
        '#FF824E',
        '#FFAD2A',
        '#FFDB04',
        '#F3F700',] },
    { name: 'presetColors', colors: [ '#6BD3B3',
      '#FCC550',
      '#408184',
      '#66CBE2',
      '#EE5960',
      '#484E5A',
      '#FF874E',
      '#03748E',
      '#C9BBAB',
      '#B17BAA',
      // Pastels
      '#B5E9D9',
      '#FDE2A7',
      '#9FC0C1',
      '#B2E5F0',
      '#F6ACAF',
      '#A4A6AC',
      '#FFC3A6',
      '#81B9C6',
      '#E4DDD5',
      '#D9BDD5',] },
    { name: 'Preset + Superset', colors: [ '#004960',
      '#2893B3',
      '#20A7C9',
      '#5CC0DA',
      '#7DCDE1',
      '#A9D3E1',
      '#C6ECE1',
      '#AAE2D2',
      '#71CFB4',
      '#2FC096',
      '#178F7A',
      '#067162',] },
    { name: 'Red to yellow', colors: [ '#90042A',
      '#D60039',
      '#D1353B',
      '#E45233',
      '#F47028',
      '#FE8E17',
      '#FFAD00',
      '#FFCC00',
      '#FFE601',
      '#FFF46D',] },
  
    { name: 'Waves of blue', colors: [ '#070061',
      '#0A0095',
      '#0054B4',
      '#006BE7',
      '#2289FF',
      '#4A9FFF',
      '#76B6FF',
      '#9DCBFF',
      '#BEDCFF',
      '#DAEBFF',] },
  
    { name: 'blueToGreen', colors: ['#3200A7',
        '#004CDA',
        '#0074F1',
        '#0096EF',
        '#53BFFF',
        '#41C8E6',
        '#30DEDE',
        '#04D9C7',
        '#00EAA2',
        '#A6FF93',] },
  
    // Add more color schemes as needed
  ];
  
  interface ColorSchemeDropdownProps {
    onColorSchemeChange: (schemeName: string) => void;
  }
  
  const ColorSchemeDropdown: React.FC<ColorSchemeDropdownProps> = ({
    onColorSchemeChange,
  }) => {
    const [selectedScheme, setSelectedScheme] = useState(colorSchemes[0].name);
  
    const handleChange = (value: string) => {
      setSelectedScheme(value);
      onColorSchemeChange(value);
    };
  
    const getColorSchemeByName = (name: string) => {
      return colorSchemes.find((scheme) => scheme.name === name);
    };
  
    // Limit the display to first 5 colors
    const displayedColors = getColorSchemeByName(selectedScheme)?.colors.slice(0, 5) ?? [];
    const hasMoreColors =
      getColorSchemeByName(selectedScheme)?.colors.length ?? 0 > 5;
  
    return (
      <Select value={selectedScheme} onValueChange={handleChange}>
        <SelectTrigger className="bg-white border border-gray-300">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center">
              <span className="mr-2">
                {getColorSchemeByName(selectedScheme)?.name}
              </span>
              <div className="flex gap-1">
                {displayedColors.map((color, index) => (
                  <div
                    key={index}
                    className="w-3 h-3"
                    style={{ backgroundColor: color }}
                  />
                ))}
                {hasMoreColors && <span className="ml-1">...</span>}
              </div>
            </div>
          </div>
        </SelectTrigger>
        <SelectContent className="bg-white border border-gray-300">
          <SelectGroup>
            <SelectLabel>Color Schemes</SelectLabel>
            {colorSchemes.map((scheme, index) => (
              <SelectItem key={index} value={scheme.name}>
                <div className="flex justify-between items-center w-full">
                  <span>{scheme.name}</span>
                  <div className="flex gap-1 ml-2">
                    {scheme.colors.slice(0, 5).map((color, colorIndex) => (
                      <div
                        key={colorIndex}
                        className="w-3 h-3"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    {scheme.colors.length > 5 && <span className="ml-1">...</span>}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  };
  
  export default ColorSchemeDropdown;
  


  // return (
  //   <div className="relative flex-1 bg-white p-4 overflow-y-auto">
  //     <div className="flex items-center justify-between mb-4">
  //       <div className="flex items-center space-x-2 flex-grow">
  //         <img 
  //           src={AI_Animation_5} 
  //           alt="AI Animation" 
  //           className="w-8 h-8"
  //         />
  //         <Input 
  //           placeholder="Ask Algo AI / Search..." 
  //           className="flex-grow"
  //         />
  //         <Button size="icon" className="bg-[#682a7a] hover:bg-[#562362]">
  //           <Send className="h-4 w-4 text-white" />
  //         </Button>
  //       </div>
        
  //       <div className="flex items-center space-x-2">
  //         <TooltipProvider>
  //           <Tooltip>
  //             <TooltipTrigger asChild>
  //               <Popover>
  //                 <PopoverTrigger asChild>
  //                   <Button variant="ghost" size="sm" className="p-2 rounded-full">
  //                     <IconSettings size={20} style={{ color: '#682a7a' }} />
  //                   </Button>
  //                 </PopoverTrigger>
  //                 <PopoverContent className="w-80 bg-white">
  //                   <CustomizeContent />
  //                 </PopoverContent>
  //               </Popover>
  //             </TooltipTrigger>
  //             <TooltipContent>
  //               <p>Customize</p>
  //             </TooltipContent>
  //           </Tooltip>
  //         </TooltipProvider>
  //         <Button
  //           onClick={handleSave}
  //           className="bg-[#682a7a] hover:bg-[#562362] text-white px-4 py-2 text-sm rounded-full flex items-center h-9"
  //         >
  //           <IconDeviceFloppy size={16} stroke={1.5} className="mr-2" />
  //           Save
  //         </Button>
  //         <Button
  //           onClick={handleCancel}
  //           variant="secondary"
  //           className="px-4 py-2 text-sm rounded-full h-9"
  //         >
  //           Cancel
  //         </Button>
  //       </div>
  //     </div>