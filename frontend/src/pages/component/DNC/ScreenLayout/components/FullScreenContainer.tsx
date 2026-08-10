import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface FullscreenContainerProps {
  children: React.ReactNode;
  className?: string;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export const FullscreenContainer: React.FC<FullscreenContainerProps> = ({ 
  children, 
  className = '',
  onFullscreenChange 
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    onFullscreenChange?.(newFullscreenState);
  };

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isFullscreen]);

  return (
    <div 
      ref={containerRef}
      className={`relative transition-all duration-300 ease-in-out ${className} 
        ${isFullscreen 
          ? 'fixed inset-0 z-50 bg-white/95 overflow-auto' 
          : 'overflow-hidden'
        }`}
    >
      {/* Fullscreen toggle button */}
      {/* <button
        onClick={toggleFullscreen}
        className="absolute top-2 right-2 z-10 bg-white p-2 rounded-full shadow-md hover:bg-gray-100"
        aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      >
        {isFullscreen ? <Minimize2 /> : <Maximize2 />}
      </button> */}

      {/* Content container */}
      <div 
        className={`w-full h-full transition-all duration-300 
          ${isFullscreen 
            ? 'p-4 max-w-4xl mx-auto' 
            : ''
          }`}
      >
        {children}
      </div>
    </div>
  );
};