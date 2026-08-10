import React from 'react';

const ApiLoader = ({ loading }) => {
  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center h-screen">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      
      {/* Loader centered on screen */}
      <div className="relative z-10">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 100 100" 
          preserveAspectRatio="xMidYMid"
          className="w-20 h-20"
        >
          <g>
            <circle fill="#050f2c" r="10" cy="50" cx="84">
              <animate
                begin="0s"
                keySplines="0 0.5 0.5 1"
                values="10;0"
                keyTimes="0;1"
                calcMode="spline"
                dur="0.25s"
                repeatCount="indefinite"
                attributeName="r"
              />
              <animate
                begin="0s"
                values="#050f2c;#3369e7;#00aeff;#003666;#050f2c"
                keyTimes="0;0.25;0.5;0.75;1"
                calcMode="discrete"
                dur="1s"
                repeatCount="indefinite"
                attributeName="fill"
              />
            </circle>
            <circle fill="#050f2c" r="10" cy="50" cx="16">
              <animate
                begin="0s"
                keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1"
                values="0;0;10;10;10"
                keyTimes="0;0.25;0.5;0.75;1"
                calcMode="spline"
                dur="1s"
                repeatCount="indefinite"
                attributeName="r"
              />
              <animate
                begin="0s"
                keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1"
                values="16;16;16;50;84"
                keyTimes="0;0.25;0.5;0.75;1"
                calcMode="spline"
                dur="1s"
                repeatCount="indefinite"
                attributeName="cx"
              />
            </circle>
            <circle fill="#003666" r="10" cy="50" cx="50">
              <animate
                begin="-0.25s"
                keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1"
                values="0;0;10;10;10"
                keyTimes="0;0.25;0.5;0.75;1"
                calcMode="spline"
                dur="1s"
                repeatCount="indefinite"
                attributeName="r"
              />
              <animate
                begin="-0.25s"
                keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1"
                values="16;16;16;50;84"
                keyTimes="0;0.25;0.5;0.75;1"
                calcMode="spline"
                dur="1s"
                repeatCount="indefinite"
                attributeName="cx"
              />
            </circle>
            <circle fill="#00aeff" r="10" cy="50" cx="84">
              <animate
                begin="-0.5s"
                keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1"
                values="0;0;10;10;10"
                keyTimes="0;0.25;0.5;0.75;1"
                calcMode="spline"
                dur="1s"
                repeatCount="indefinite"
                attributeName="r"
              />
              <animate
                begin="-0.5s"
                keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1"
                values="16;16;16;50;84"
                keyTimes="0;0.25;0.5;0.75;1"
                calcMode="spline"
                dur="1s"
                repeatCount="indefinite"
                attributeName="cx"
              />
            </circle>
            <circle fill="#3369e7" r="10" cy="50" cx="16">
              <animate
                begin="-0.75s"
                keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1"
                values="0;0;10;10;10"
                keyTimes="0;0.25;0.5;0.75;1"
                calcMode="spline"
                dur="1s"
                repeatCount="indefinite"
                attributeName="r"
              />
              <animate
                begin="-0.75s"
                keySplines="0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1;0 0.5 0.5 1"
                values="16;16;16;50;84"
                keyTimes="0;0.25;0.5;0.75;1"
                calcMode="spline"
                dur="1s"
                repeatCount="indefinite"
                attributeName="cx"
              />
            </circle>
          </g>
        </svg>
      </div>
    </div>
  );
};

export default ApiLoader;