

import React, { useRef, useState, useEffect } from 'react';

interface BigNumberProps {
  data: {
    chartType: string;
    chartData: Array<Record<string, any>>;
  };
  title?: string;
  classNames?: string;
  textSize?: number;
}

const BigNumber: React.FC<BigNumberProps> = ({ data, title, classNames, textSize }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(textSize);

  // Extract the value from the chartData with better null checking
  const value = data?.chartData?.[0] ? Object.values(data.chartData[0])[0] : '0';

  // Format the number with null checking
  const formattedValue = typeof value === 'number'
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(value || '0'); // Convert to string and provide fallback

  useEffect(() => {
    const updateFontSize = () => {
      if (!containerRef.current || !formattedValue) {
        return; // Early return if refs or value not available
      }

      const containerWidth = containerRef.current.offsetWidth;
      const containerHeight = containerRef.current.offsetHeight;

      // Skip calculation if container dimensions are not available
      if (!containerWidth || !containerHeight) {
        return;
      }

      // Calculate the area of the container
      const containerArea = containerWidth * containerHeight;

      // Base font size on the square root of the area
      let baseFontSize = Math.sqrt(containerArea) / 4;

      // Adjust for text length - with safe access to length
      const textLength = String(formattedValue).length;
      baseFontSize *= Math.max(1 - (textLength - 5) * 0.1, 0.5);

      // Ensure font size is within bounds
      const minFontSize = 12;
      const maxFontSize = 120;
      const newFontSize = Math.max(minFontSize, Math.min(baseFontSize, maxFontSize));

      setFontSize(newFontSize);
    };

    // Initial update
    updateFontSize();

    // Use ResizeObserver for more precise size change detection
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateFontSize); // Use requestAnimationFrame for smoother updates
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [formattedValue]); // Only depend on formattedValue

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex flex-col items-center justify-center p-2 overflow-hidden"
      style={{ minHeight: '50px', minWidth: '50px' }}
    >
      {title && (
        <h2 className={`sm:text-xs md:text-sm lg:text-md font-semibold mb-1 text-center ${classNames}`}>
          {title}
        </h2>
      )}
      <div
        ref={valueRef}
        className={`font-bold text-center break-words transition-all duration-200 ease-in-out text-clamp ${classNames}`}
        style={{
          lineHeight: '1.2',
          maxWidth: '100%',
        }}
      >
        {formattedValue}%
      </div>
    </div>
  );
};

export default BigNumber;