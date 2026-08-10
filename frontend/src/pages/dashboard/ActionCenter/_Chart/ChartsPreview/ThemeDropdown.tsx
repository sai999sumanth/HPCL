import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../@/components/ui/select';

interface ThemeDropdownProps {
  onThemeChange: (theme: string) => void;
  selectedTheme: string;
}

// Theme color configurations
const themeData = {
  'Westeros': ["#90D5FF", "#64C4FF", "#37B3FF", "#0BA3FF", "#008ADE", "#006EB1", "#005385", "#003759"],
  'Essos': ['#893448', '#d95850', '#eb8146', '#ffb248', '#f2d643', '#ebdba4'],
  'Wonderland': ['#4ea397', '#22c3aa', '#7bd9a5', '#d0648a', '#f58db2', '#f2b3c9'],
  'Walden': ['#3fb1e3', '#6be6c1', '#626c91', '#a0a7e6', '#c4ebad', '#96dee8'],
  'Infographic': ['#c1232b', '#27727b', '#fcce10', '#e87c25', '#b5c334', '#fe8463'],
  'Macarons': ['#2ec7c9', '#b6a2de', '#5ab1ef', '#ffb980', '#d87a80', '#8d98b3'],
  'Roma': ['#e01f54', '#001852', '#f5e8c8', '#b8d2c7', '#c6b38e', '#a4d8c2'],
  'CoolTheme': ['#00a8e1', '#99cc00', '#ff9900', '#009944', '#ff0066', '#9933cc'],
  'Shine': ['#c12e34', '#e6b600', '#0098d9', '#2b821d', '#005eaa', '#339ca8']
};

const ThemeDropdown: React.FC<ThemeDropdownProps> = ({ onThemeChange, selectedTheme }) => {
  return (
    <Select onValueChange={onThemeChange} value={selectedTheme}>
      <SelectTrigger className="bg-white text-black">
        <SelectValue placeholder="Select a theme" />
      </SelectTrigger>
      <SelectContent className="bg-white min-w-[200px] max-h-[300px] overflow-y-auto">
        {Object.entries(themeData).map(([theme, colors]) => (
          <SelectItem key={theme} value={theme} className="py-2">
            <div className="flex items-center justify-between w-full">
              <span>{theme}</span>
              <div className="flex ml-2">
                {colors.slice(0, 10).map((color, index) => (
                  <div
                    key={index}
                    className="w-3 h-3 rounded-sm"
                    style={{
                      backgroundColor: color,
                      marginLeft: '1px'
                    }}
                  />
                ))}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ThemeDropdown;