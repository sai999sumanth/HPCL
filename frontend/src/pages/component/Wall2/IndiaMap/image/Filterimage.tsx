// src/components/FilterImage.tsx

import React from "react";

interface FilterImageProps {
  src: string;
  alt: string;
}

const FilterImage: React.FC<FilterImageProps> = ({ src, alt }) => {
  return (
    <div className="group relative p-3 rounded-md hover:bg-slate-800 transition-colors cursor-pointer">
      <img
        src={src}
        alt={alt}
        className="w-12 h-12 object-contain transition-transform duration-300 group-hover:scale-110"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />

      {/* Tooltip */}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="relative px-3 py-1 text-xs font-semibold text-white bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-md shadow-xl whitespace-nowrap">
          {alt}
          {/* Tooltip Arrow */}
          <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-slate-900/90 border-l border-t border-white/10"></div>
        </div>
      </div>
    </div>
  );
};

export default FilterImage;
