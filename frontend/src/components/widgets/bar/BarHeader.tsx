import React, { useState } from "react";

type ToggleSwitchProps = {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
};

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  label,
  checked,
  onChange,
}) => (
  <div id={id} className="mb-4 flex items-center">
    <label className="inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only peer"
      />
      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"></div>
      <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
        {label}
      </span>
    </label>
  </div>
);

type RadioInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  options: { label: string; value: string; disabled?: boolean }[];
};

const RadioInput: React.FC<RadioInputProps> = ({
  id,
  label,
  value,
  onChange,
  options,
}) => (
  <div id={id} className="mb-6">
    <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
      {label}
    </h3>
    <div className="grid grid-cols-2 gap-4">
      {options.map((option) => (
        <div key={option.value} className="flex items-center space-x-3">
          <input
            id={`radio-${id}-${option.value}`}
            type="radio"
            value={option.value}
            name={`radio-${id}`}
            checked={value === option.value}
            onChange={onChange}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-700 dark:focus:ring-offset-gray-700 focus:ring-2 dark:bg-gray-600 dark:border-gray-500"
          />
          <label
            htmlFor={`radio-${id}-${option.value}`}
            className="text-sm font-medium text-gray-900 dark:text-gray-300"
          >
            {option.label}
          </label>
        </div>
      ))}
    </div>
  </div>
);

type ConfigType = {
  scrollbarX?: boolean;
  scrollbarXPosition?: string;
  scrollbarY?: boolean;
  scrollbarYPosition?: string;
  showLegend?: boolean;
  legendPosition?: string;
  title?: string;
};

type BarHeaderProps = {
  config?: ConfigType;
  header?: React.ReactNode;
  setConfig?: any;
};

const BarHeader: React.FC<BarHeaderProps> = ({ header, config, setConfig }) => {
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const togglePopup = () => setIsPopupVisible(!isPopupVisible);

  return (
    <>
      <div className="relative flex justify-between items-center mb-4">
        {header}
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mt-3 mb-3">
          {config?.title}
        </h2>
        <svg
          onClick={togglePopup}
          width="20px"
          height="20px"
          viewBox="-0.5 0 25 25"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="cursor-pointer"
        >
          <path
            d="M12 7.82001H22"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 7.82001H4"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20 16.82H22"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 16.82H12"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 11.82C10.2091 11.82 12 10.0291 12 7.82001C12 5.61087 10.2091 3.82001 8 3.82001C5.79086 3.82001 4 5.61087 4 7.82001C4 10.0291 5.79086 11.82 8 11.82Z"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 20.82C18.2091 20.82 20 19.0291 20 16.82C20 14.6109 18.2091 12.82 16 12.82C13.7909 12.82 12 14.6109 12 16.82C12 19.0291 13.7909 20.82 16 20.82Z"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {isPopupVisible && (
          <div
            className="absolute right-0 w-64 bg-white border border-gray-300 shadow-lg rounded-md p-6"
            style={{
              zIndex: 9999,
              top: 0,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg text-gray-800">Settings</h3>
              <button
                onClick={togglePopup}
                className="text-red-500 hover:text-red-600 transition-all duration-200"
              >
                X
              </button>
            </div>
            <ToggleSwitch
              id="x-axis-scrollbar"
              label="X-Axis Scrollbar"
              checked={config?.scrollbarX}
              onChange={() =>
                setConfig((prev: any) => ({
                  ...prev,
                  scrollbarX: !prev.scrollbarX,
                }))
              }
            />
            {config?.scrollbarX && (
              <RadioInput
                label="Scroll X Position"
                id="scroll-x-position"
                value={config?.scrollbarXPosition}
                onChange={(e) =>
                  setConfig({ ...config, scrollbarXPosition: e.target.value })
                }
                options={[
                  { label: "top", value: "top" },
                  { label: "bottom", value: "bottom" },
                ]}
              />
            )}
            <ToggleSwitch
              id="y-axis-scrollbar"
              label="Y-Axis Scrollbar"
              checked={config?.scrollbarY}
              onChange={() =>
                setConfig((prev: any) => ({
                  ...prev,
                  scrollbarY: !prev.scrollbarY,
                }))
              }
            />
            {config?.scrollbarY && (
              <RadioInput
                label="Scroll Y Position"
                id="scroll-y-position"
                value={config?.scrollbarYPosition}
                onChange={(e) =>
                  setConfig({ ...config, scrollbarYPosition: e.target.value })
                }
                options={[
                  { label: "left", value: "left" },
                  { label: "right", value: "right" },
                ]}
              />
            )}
            <ToggleSwitch
              label="Show Legend"
              checked={config?.showLegend}
              onChange={() =>
                setConfig({ ...config, showLegend: !config?.showLegend })
              }
              id="show-legend"
            />
            {config?.showLegend && (
              <RadioInput
                id="legend-position"
                label="Legend Position"
                value={config?.legendPosition}
                onChange={(e) =>
                  setConfig({ ...config, legendPosition: e.target.value })
                }
                options={[
                  { label: "top", value: "top" },
                  { label: "bottom", value: "bottom" },
                ]}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default BarHeader;
