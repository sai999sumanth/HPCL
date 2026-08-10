import React, { useState } from 'react';
import { X } from 'lucide-react';

// Import images
import infrastructureImg from '../../assets/hpcl/infraa.jpeg';
import operationsImg from '../../assets/hpcl/Misson60.png';
import performanceImg from '../../assets/hpcl/SalesPerformance.png';
import governanceImg from '../../assets/hpcl/IndustryPerformance.png';
import inventoryImg from '../../assets/hpcl/infraa.jpeg';
import customerImg from '../../assets/hpcl/ops.jpg';
import { Console } from 'console';

const menuItems = [  
    { 
        title: 'Mission 60', 
        image: operationsImg,
        url: '#'
      },
    { 
      title: 'Sales Performance', 
      image: performanceImg,
      url: '#'
    },
    { 
      title: 'Industry Performance', 
      image: governanceImg,
      url: '#'
    }
];

const Modal = ({ isOpen, onClose, url, title }) => {
    console.log(url);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div  onClick={onClose}></div>
      <div className="relative w-11/12 h-5/6 bg-white rounded-lg shadow-xl z-10">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="h-[calc(100%-4rem)]">
          <iframe
            src={url}
            title={title}
            className="w-full h-full"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};

const PerformancePage = () => {
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {menuItems.map((item, index) => (
            <div
              key={index}
              onClick={() => item.url !== '#' && setSelectedItem(item)}
              className="bg-white rounded-xl shadow-md overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer border border-gray-200"
            >
              <div className="relative h-48 overflow-hidden">
                {item.url !== '#' ? (
                  <iframe
                    src={item.url}
                    title={item.title}
                    className="w-full h-full"
                    sandbox="allow-same-origin allow-scripts"
                  />
                ) : (
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{item.title}</h3>
                {item.url !== '#' && (
                  <div className="flex items-center text-blue-600">
                    <span className="text-sm">View Dashboard →</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        url={selectedItem?.url}
        title={selectedItem?.title}
      />
    </div>
  );
};

export default PerformancePage;


// import React, { useEffect, useRef, useState } from 'react';
// import { X } from 'lucide-react';

// declare global {
//   interface Window {
//     spotfire: any;
//   }
// }

// interface SpotfireViewerProps { 
//   url: string;
//   path: string;
//   height?: string | number;
//   width?: string | number;
// }

// const SpotfireViewer = ({ url, path, height = '600px', width = '100%' }: SpotfireViewerProps) => { 
//   const containerRef = useRef<HTMLDivElement>(null);
//   const [error, setError] = useState<string>('');

//   useEffect(() => { 
//     const loadSpotfire = async () => { 
//       try {
//         if (!containerRef.current) return;

//         const customization = new window.spotfire.webPlayer.Customization();
//         customization.showAbout = false;
//         customization.showAnalysisInformationTool = false;
//         customization.showAuthor = false;
//         customization.showClose = false;
//         customization.showCustomizableHeader = false;
//         customization.showDodPanel = false;
//         customization.showExportFile = false;
//         customization.showExportVisualization = false;
//         customization.showFilterPanel = false;
//         customization.showHelp = false;
//         customization.showLogout = false;
//         customization.showPageNavigation = false;
//         customization.showAnalysisInformation = false;
//         customization.showReloadAnalysis = false;
//         customization.showStatusBar = false;
//         customization.showToolBar = false;
//         customization.showUndoRedo = false;

//         const app = new window.spotfire.webPlayer.Application(
//           url,
//           customization,
//           path
//         );

//         const doc = await app.openDocument(containerRef.current.id);

//         app.onError((errorCode: string, description: string) => {
//           setError(`Error ${errorCode}: ${description}`);
//         });

//       } catch (err) {
//         setError(err instanceof Error ? err.message : 'Failed to load Spotfire dashboard');
//       }
//     };

//     loadSpotfire();
//   }, [url, path]);

//   return (
//     <div className="relative w-full h-full">
//       {error && (
//         <div className="absolute top-0 left-0 right-0 bg-red-100 text-red-700 p-3 text-sm">
//           {error}
//         </div>
//       )}
//       <div
//         id={`spotfire-${Math.random().toString(36).substr(2, 9)}`}
//         ref={containerRef}
//         style={{ height, width }}
//       />
//     </div>
//   );
// };

// const PerformancePage = () => {
//   const [selectedDashboard, setSelectedDashboard] = useState<null | {
//     title: string;
//     url: string;
//     path: string;
//   }>(null);

//   const dashboards = [
//     {
//       title: 'Sales Performance',
//       url: 'https://spotfire.hpcl.co.in/spotfire/wp/',
//       path: '/Connected_Enterprise/Dashboard/1.01%20Customer%20Sales%20Performance',
//       image: '/path-to-fallback-image.jpg'
//     },
//     {
//       title: 'Mission 60',
//       url: 'https://spotfire.hpcl.co.in/spotfire/wp/',
//       path: '/Connected_Enterprise/CPO_Dashboards/Actual%20VS%20Sales%20Data_VW%20%281%29',
//       image: '/path-to-fallback-image.jpg'
//     },
//     {
//       title: 'Industry Performance',
//       url: 'https://spotfire.hpcl.co.in/spotfire/wp/',
//       path: '/Connected_Enterprise/Dashboard/1.02%20Industry%20Performance',
//       image: '/path-to-fallback-image.jpg'
//     }
//   ];

//   return (
//     <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
//       <div className="max-w-7xl mx-auto">
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
//           {dashboards.map((dashboard, index) => (
//             <div
//               key={index}
//               onClick={() => setSelectedDashboard(dashboard)}
//               className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300"
//             >
//               <div className="h-48 relative">
//                 <SpotfireViewer
//                   url={dashboard.url}
//                   path={dashboard.path}
//                   height="100%"
//                 />
//               </div>
//               <div className="p-4">
//                 <h3 className="text-lg font-semibold text-gray-800">{dashboard.title}</h3>
//                 <p className="text-sm text-blue-600 mt-2">View Full Dashboard →</p>
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>

//       {selectedDashboard && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
//           <div className="bg-white rounded-lg w-11/12 h-5/6 flex flex-col">
//             <div className="flex justify-between items-center p-4 border-b">
//               <h2 className="text-xl font-semibold">{selectedDashboard.title}</h2>
//               <button
//                 onClick={() => setSelectedDashboard(null)}
//                 className="p-2 hover:bg-gray-100 rounded-full"
//               >
//                 <X className="w-6 h-6" />
//               </button>
//             </div>
//             <div className="flex-1">
//               <SpotfireViewer
//                 url={selectedDashboard.url}
//                 path={selectedDashboard.path}
//                 height="100%"
//               />
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default PerformancePage;