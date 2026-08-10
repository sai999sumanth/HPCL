// import React, { useRef, useState } from 'react';
// import { DndProvider } from 'react-dnd';
// import { HTML5Backend } from 'react-dnd-html5-backend';
// import ChartSource from './ChartsSource/ChartsSource';
// import ChartTabs from './ChartsTabs/ChartsTabs';
// import ChartPreview from './ChartsPreview/ChartsPreview';

// interface ChartCreateProps {
//   dataset: string;
//   chartType: string;
// }

// const ChartsPage: React.FC<ChartCreateProps> = ({ dataset, chartType }) => {
//   const [chartData, setChartData] = useState<any>(null);
//   const [selectedTheme, setSelectedTheme] = useState('Westeros');
//   const chartTabsRef = useRef<any>(null);

//   const handleChartCreated = (chartOptions: any) => {
//     setChartData(chartOptions);
//   };

//   const handleThemeChange = (theme: string) => {
//     setSelectedTheme(theme);
//   };

//   return (
//     <DndProvider backend={HTML5Backend}>
//       <div className="flex flex-col h-screen">
//         <div className="flex flex-1 overflow-hidden">
//           <ChartSource dataset={dataset} />
//           <ChartTabs
//             onChartCreated={handleChartCreated}
//             dataset={dataset}
//             chartType={chartType}
//             onThemeChange={handleThemeChange}
//             selectedTheme={selectedTheme}
//           />
//           <ChartPreview
//             chartData={chartData}
//             chartType={chartType}
//             selectedTheme={selectedTheme}
//             setChartData={setChartData} // Pass the setChartData function to ChartPreview
//           />
//         </div>
//       </div>
//     </DndProvider>
//   );
// };

// // export default ChartsPage;
// import React, { useRef, useState } from 'react';
// import { DndProvider } from 'react-dnd';
// import { HTML5Backend } from 'react-dnd-html5-backend';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../@/components/ui/tabs";
// import ChartSource from './ChartsSource/ChartsSource';
// import ChartTabs from './ChartsTabs/ChartsTabs';
// import ChartPreview from './ChartsPreview/ChartsPreview';
// import AskAITab from './ChartsTabs/AskAITab';
// import QueryTab from './ChartsTabs/QueryTab';
// interface ChartCreateProps {
//   dataset: string;
//   chartType: string;
// }

// const ChartsPage: React.FC<ChartCreateProps> = ({ dataset, chartType }) => {
//   const [chartData, setChartData] = useState<any>(null);
//   const [selectedTheme, setSelectedTheme] = useState('Westeros');
//   const chartTabsRef = useRef<any>(null);

//   const handleChartCreated = (chartOptions: any) => {
//     setChartData(chartOptions);
//   };

//   const handleThemeChange = (theme: string) => {
//     setSelectedTheme(theme);
//   };

//   return (
//     <DndProvider backend={HTML5Backend}>
//       <div className="flex flex-col h-screen">
//         <Tabs defaultValue="default" className="w-full">
//           <TabsList>
//             <TabsTrigger value="default">Default</TabsTrigger>
//             <TabsTrigger value="askai">Ask AI</TabsTrigger>
//             <TabsTrigger value="query">Query</TabsTrigger>
//           </TabsList>
//           <TabsContent value="default">
//             <div className="flex flex-1 overflow-hidden">
//               <ChartSource dataset={dataset} />
//               <ChartTabs
//                 onChartCreated={handleChartCreated}
//                 dataset={dataset}
//                 chartType={chartType}
//                 onThemeChange={handleThemeChange}
//                 selectedTheme={selectedTheme}
//               />
//               <ChartPreview
//                 chartData={chartData}
//                 chartType={chartType}
//                 selectedTheme={selectedTheme}
//                 setChartData={setChartData}
//               />
//             </div>
//           </TabsContent>
//           <TabsContent value="askai">
//             <AskAITab />
//           </TabsContent>
//           <TabsContent value="query">
//             <QueryTab />
//           </TabsContent>
//         </Tabs>
//       </div>
//     </DndProvider>
//   );
// };

// export default ChartsPage;

// import React, { useRef, useState } from 'react';
// import { DndProvider } from 'react-dnd';
// import { HTML5Backend } from 'react-dnd-html5-backend';
// import ChartSource from './ChartsSource/ChartsSource';
// import ChartTabs from './ChartsTabs/ChartsTabs';
// import ChartPreview from './ChartsPreview/ChartsPreview';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../@/components/ui/tabs';
// import AskAITab from './ChartsTabs/AskAITab';
// import QueryTab from './ChartsTabs/QueryTab';
// interface ChartCreateProps {
//   dataset: string;
//   chartType: string;
// }

// const ChartsPage: React.FC<ChartCreateProps> = ({ dataset, chartType }) => {
//   const [chartData, setChartData] = useState<any>(null);
//   const [selectedTheme, setSelectedTheme] = useState('Westeros');
//   const chartTabsRef = useRef<any>(null);

//   const handleChartCreated = (chartOptions: any) => {
//     setChartData(chartOptions);
//   };

//   const handleThemeChange = (theme: string) => {
//     setSelectedTheme(theme);
//   };

//   return (
//     <DndProvider backend={HTML5Backend}>
//       <div className="flex flex-col h-screen">
//         <Tabs defaultValue="default" className="w-full">
//           <TabsList className="bg-white">
//             <TabsTrigger className="bg-white"  value="default">Default</TabsTrigger>
//             <TabsTrigger className="bg-white" value="askai">Ask AI</TabsTrigger>
//             <TabsTrigger className="bg-white" value="query">Query</TabsTrigger>
//           </TabsList>
//           <TabsContent value="default">
//             <div className="flex flex-1 overflow-hidden">
//               <ChartSource dataset={dataset} />
//               <ChartTabs
//                 onChartCreated={handleChartCreated}
//                 dataset={dataset}
//                 chartType={chartType}
//                 onThemeChange={handleThemeChange}
//                 selectedTheme={selectedTheme}
//               />
//               <ChartPreview
//                 chartData={chartData}
//                 chartType={chartType}
//                 selectedTheme={selectedTheme}
//                 setChartData={setChartData}
//               />
//             </div>
//           </TabsContent>
//           <TabsContent value="askai">
//             <AskAITab />
//           </TabsContent>
//           <TabsContent value="query">
//             <QueryTab />
//           </TabsContent>
//         </Tabs>
//       </div>
//     </DndProvider>
//   );
// };

// export default ChartsPage;

//=>tabs
// import React, { useRef, useState } from 'react';
// import { DndProvider } from 'react-dnd';
// import { HTML5Backend } from 'react-dnd-html5-backend';
// import ChartSource from './ChartsSource/ChartsSource';
// import ChartTabs from './ChartsTabs/ChartsTabs';
// import ChartPreview from './ChartsPreview/ChartsPreview';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../@/components/ui/tabs';
// import AskAITab from './ChartsTabs/AskAITab';
// import QueryTab from './ChartsTabs/QueryTab';
// interface ChartCreateProps {
//   dataset: string;
//   chartType: string;
// }

// const ChartsPage: React.FC<ChartCreateProps> = ({ dataset, chartType }) => {
//   const [chartData, setChartData] = useState<any>(null);
//   const [selectedTheme, setSelectedTheme] = useState('Westeros');
//   const chartTabsRef = useRef<any>(null);

//   const handleChartCreated = (chartOptions: any) => {
//     setChartData(chartOptions);
//   };

//   const handleThemeChange = (theme: string) => {
//     setSelectedTheme(theme);
//   };

//   return (
//     <DndProvider backend={HTML5Backend}>
//       <div className="flex flex-col h-screen">
//         <Tabs defaultValue="default" className="w-full">
//           <TabsList className="bg-white">
//             <TabsTrigger className="bg-white"  value="default">Default</TabsTrigger>
//             <TabsTrigger className="bg-white" value="askai">Ask AI</TabsTrigger>
//             <TabsTrigger className="bg-white" value="query">Query</TabsTrigger>
//           </TabsList>
//           <TabsContent value="default">
//             <div className="flex flex-1 overflow-hidden">
//               <ChartSource dataset={dataset} />
//               <ChartTabs
//                 onChartCreated={handleChartCreated}
//                 dataset={dataset}
//                 chartType={chartType}
//                 onThemeChange={handleThemeChange}
//                 selectedTheme={selectedTheme}
//               />
//               <ChartPreview
//                 chartData={chartData}
//                 chartType={chartType}
//                 selectedTheme={selectedTheme}
//                 setChartData={setChartData}
//               />
//             </div>
//           </TabsContent>
//           <TabsContent value="askai">
//             <AskAITab />
//           </TabsContent>
//           <TabsContent value="query">
//             <QueryTab />
//           </TabsContent>
//         </Tabs>
//       </div>
//     </DndProvider>
//   );
// };

// export default ChartsPage;


// import React, { useRef, useState } from 'react';
// import { DndProvider } from 'react-dnd';
// import { HTML5Backend } from 'react-dnd-html5-backend';
// import ChartSource from './ChartsSource/ChartsSource';
// import ChartTabs from './ChartsTabs/charttabsfakefile';
// import ChartPreview from './ChartsPreview/ChartsPreview';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../@/components/ui/tabs';
// import AskAITab from './ChartsTabs/AskAITab';
// import QueryTab from './ChartsTabs/QueryTab';

// interface ChartCreateProps {
//   dataset: string;
//   chartType: string;
// }

// const ChartsPage: React.FC<ChartCreateProps> = ({ dataset, chartType }) => {
//   const [chartData, setChartData] = useState<any>(null);
//   const [selectedTheme, setSelectedTheme] = useState('Westeros');
//   const chartTabsRef = useRef<any>(null);

//   const handleChartCreated = (chartOptions: any) => {
//     setChartData(chartOptions);
//   };

//   const handleThemeChange = (theme: string) => {
//     setSelectedTheme(theme);
//   };

//   return (
//     <DndProvider backend={HTML5Backend}>
//       <div className="flex flex-col h-screen">
//         <Tabs defaultValue="default" className="w-full h-full flex flex-col">
//           <TabsList className="bg-white">
//             <TabsTrigger className="bg-white" value="default">Default</TabsTrigger>
//             <TabsTrigger className="bg-white" value="askai">Ask AI</TabsTrigger>
//             <TabsTrigger className="bg-white" value="query">Query</TabsTrigger>
//           </TabsList>
//           <TabsContent value="default" className="flex-grow overflow-hidden">
//             <div className="flex h-full">
//               <div className="w-1/4 overflow-y-auto border-r">
//                 <ChartSource dataset={dataset} />
//               </div>
//                 <ChartTabs
//                   onChartCreated={handleChartCreated}
//                   dataset={dataset}
//                   chartType={chartType}
//                   onThemeChange={handleThemeChange}
//                   selectedTheme={selectedTheme}
//                 />
              
//                 <ChartPreview
//                   chartData={chartData}
//                   chartType={chartType}
//                   selectedTheme={selectedTheme}
//                   setChartData={setChartData}
//                 />
//             </div>
//           </TabsContent>
//           <TabsContent value="askai" className="flex-grow overflow-y-auto">
//             <AskAITab />
//           </TabsContent>
//           <TabsContent value="query" className="flex-grow overflow-y-auto">
//             <QueryTab />
//           </TabsContent>
//         </Tabs>
//       </div>
//     </DndProvider>
//   );
// };

// export default ChartsPage;

// import React, { useRef, useState } from 'react';
// import { DndProvider } from 'react-dnd';
// import { HTML5Backend } from 'react-dnd-html5-backend';
// import ChartSource from './ChartsSource/ChartsSource';
// import ChartTabs from './ChartsTabs/ChartsTabs';
// import ChartPreview from './ChartsPreview/ChartsPreview';

// interface ChartCreateProps {
//   dataset: string;
//   chartType: string;
// }

// const ChartsPage: React.FC<ChartCreateProps> = ({ dataset, chartType }) => {
//   const [chartData, setChartData] = useState<any>(null);
//   const [selectedTheme, setSelectedTheme] = useState('Westeros');
//   const chartTabsRef = useRef<any>(null);

//   const handleChartCreated = (chartOptions: any) => {
//     setChartData(chartOptions);
//   };

//   const handleThemeChange = (theme: string) => {
//     setSelectedTheme(theme);
//   };

//   return (
//     <DndProvider backend={HTML5Backend}>
//       <div className="flex flex-col h-screen">
//         <div className="flex flex-1 overflow-hidden">
//           <ChartSource dataset={dataset} />
//           <ChartTabs
//             onChartCreated={handleChartCreated}
//             dataset={dataset}
//             chartType={chartType}
//             onThemeChange={handleThemeChange}
//             selectedTheme={selectedTheme}
//           />
//           <ChartPreview
//             chartData={chartData}
//             chartType={chartType}
//             selectedTheme={selectedTheme}
//             setChartData={setChartData} // Pass the setChartData function to ChartPreview
//           />
//         </div>
//       </div>
//     </DndProvider>
//   );
// };

// export default ChartsPage;





// import React, { useRef, useState } from 'react';
// import { DndProvider } from 'react-dnd';
// import { HTML5Backend } from 'react-dnd-html5-backend';
// import ChartSource from './ChartsSource/ChartsSource';
// import ChartTabs from './ChartsTabs/ChartsTabs';
// import ChartPreview from './ChartsPreview/ChartsPreview';
// import initialChartData from './json/initialChartData.json'
// interface ChartCreateProps {
//   dataset: string;
//   chartType: string;
// }

// const ChartsPage: React.FC<ChartCreateProps> = ({ dataset, chartType }) => {
//   const [chartData, setChartData] = useState<any>(null);
//   const [selectedTheme, setSelectedTheme] = useState('Westeros');
//   const chartTabsRef = useRef<any>(null);

//   const handleChartCreated = (chartOptions: any) => {
//     setChartData(chartOptions);
//   };

//   const handleThemeChange = (theme: string) => {
//     setSelectedTheme(theme);
//   };

//   return (
//     <DndProvider backend={HTML5Backend}>
//       <div className="flex flex-col h-screen">
//         <div className="flex flex-1 overflow-hidden">
//           <ChartSource dataset={dataset} />
//           <ChartTabs
//   dataset={dataset}
//   chartType={chartType}
//   onChartCreated={handleChartCreated}
//   onThemeChange={handleThemeChange}
//   selectedTheme={selectedTheme}
// />
//           <ChartPreview
//             chartData={chartData}
//             chartType={chartType}
//             selectedTheme={selectedTheme}
//             setChartData={setChartData} // Pass the setChartData function to ChartPreview
//           />
//         </div>
//       </div>
//     </DndProvider>
//   );
// };

// export default ChartsPage;

// import React, { useRef, useState, useEffect } from 'react';
// import { DndProvider } from 'react-dnd';
// import { HTML5Backend } from 'react-dnd-html5-backend';
// import ChartSource from './ChartsSource/ChartsSource';
// import ChartTabs from './ChartsTabs/ChartsTabs';
// import ChartPreview from './ChartsPreview/ChartsPreview';
// import initialChartData from './json/initialChartData.json'

// interface ChartCreateProps {
//   dataset: string;
//   chartType: string;
// }

// const ChartsPage: React.FC<ChartCreateProps> = ({ dataset, chartType }) => {
//   const [chartData, setChartData] = useState(null);
//   const [selectedTheme, setSelectedTheme] = useState('Westeros');
//   const [clearChartPreview, setClearChartPreview] = useState(false);
//   const chartTabsRef = useRef(null);

//   const handleChartCreated = (chartOptions: any) => {
//     setChartData(chartOptions);
//   };

//   const handleThemeChange = (theme: string) => {
//     setSelectedTheme(theme);
//   };

//   const handleClearChartPreview = () => {
//     setClearChartPreview(true);
//     setChartData(null);
//   };

//   useEffect(() => {
//     if (clearChartPreview) {
//       setClearChartPreview(false);
//     }
//   }, [clearChartPreview]);


// return (
//   <DndProvider backend={HTML5Backend}>
//     <div className="flex flex-col h-screen">
//       <div className="flex flex-1 overflow-hidden">
//         <ChartSource dataset={dataset} />
//         <ChartTabs

//   dataset={dataset}
//   chartType={chartType}
//   onChartCreated={handleChartCreated}
//   onThemeChange={handleThemeChange}
//   selectedTheme={selectedTheme}
//   onClearChartPreview={handleClearChartPreview}/>
//         <ChartPreview
//           chartData={chartData}
//           chartType={chartType}
//           selectedTheme={selectedTheme}
//           setChartData={setChartData} // Pass the setChartData function to ChartPreview
//           onThemeChange={function (theme: string): void {
//             throw new Error('Function not implemented.');
//           } }              />
//       </div>
//     </div>
//   </DndProvider>
// );
// };

// export default ChartsPage;


// import React, { useRef, useState, useEffect } from 'react';
// import { DndProvider } from 'react-dnd';
// import { HTML5Backend } from 'react-dnd-html5-backend';
// import ChartSource from './ChartsSource/ChartsSource';
// import ChartTabs from './ChartsTabs/ChartsTabs';
// import AskAITab from './ChartsTabs/AskAITab';
// import ChartPreview from './ChartsPreview/ChartsPreview';
// import { useSelector } from 'react-redux';
// import { RootState } from '../../../../redux/store';

// interface ChartCreateProps {
//   dataset: string;
//   chartType: string;
// }

// const ChartsPage: React.FC<ChartCreateProps> = ({ dataset, chartType }) => {
//   const [chartData, setChartData] = useState(null);
//   const [selectedTheme, setSelectedTheme] = useState('Westeros');
//   const [clearChartPreview, setClearChartPreview] = useState(false);
//   const chartTabsRef = useRef(null);

//   const handleChartCreated = (chartOptions: any) => {
//     setChartData(chartOptions);
//   };

//   const handleThemeChange = (theme: string) => {
//     setSelectedTheme(theme);
//   };

//   const handleClearChartPreview = () => {
//     setClearChartPreview(true);
//     setChartData(null);
//   };

//   useEffect(() => {
//     if (clearChartPreview) {
//       setClearChartPreview(false);
//     }
//   }, [clearChartPreview]);

//   return (
//     <DndProvider backend={HTML5Backend}>
//       <div className="flex flex-col h-[100vh]"> {/* Reduced height to 90% of viewport height */}
//         <div className="flex flex-1 overflow-hidden">
//           <ChartSource dataset={dataset} />
//           <div className="flex flex-col flex-1 h-full overflow-y-auto">
//             <div className="flex justify-center bg-white py-0">
//               <AskAITab 
//                 dataset={dataset}
//                 chartData={chartData}
//                 chartType={chartType}
//                 selectedTheme={selectedTheme}
//                 setChartData={setChartData}
//                 onThemeChange={handleThemeChange}
//                 onChartCreated={handleChartCreated}
//               />
//             </div>
//             <div className="flex flex-1">
//               <ChartTabs
//                 dataset={dataset}
//                 chartType={chartType}
//                 onChartCreated={handleChartCreated}
//                 onThemeChange={handleThemeChange}
//                 selectedTheme={selectedTheme}
//                 onClearChartPreview={handleClearChartPreview}
//               />
//               <ChartPreview
//                 dataset={dataset}
//                 chartData={chartData}
//                 chartType={chartType}
//                 selectedTheme={selectedTheme}
//                 setChartData={setChartData}
//                 onThemeChange={handleThemeChange}
//               />
//             </div>
//           </div>
//         </div>
//       </div>
//     </DndProvider>
//   );
// };

// // export default ChartsPage;
// import React, { useRef, useState, useEffect } from 'react';
// import { DndProvider } from 'react-dnd';
// import { HTML5Backend } from 'react-dnd-html5-backend';
// import ChartSource from './ChartsSource/ChartsSource';
// import ChartTabs from './ChartsTabs/ChartsTabs';
// import AskAITab from './ChartsTabs/AskAITab';
// import ChartPreview from './ChartsPreview/ChartsPreview';
// import { useSelector } from 'react-redux';
// import { RootState } from '../../../../redux/store';

// interface ChartCreateProps {
//   dataset: string;
//   chartType: string;
// }

// const ChartsPage: React.FC<ChartCreateProps> = ({ dataset, chartType }) => {
//   const [chartData, setChartData] = useState(null);
//   const [selectedTheme, setSelectedTheme] = useState('Westeros');
//   const [clearChartPreview, setClearChartPreview] = useState(false);
//   const chartTabsRef = useRef(null);

//   const handleChartCreated = (chartOptions: any) => {
//     setChartData(chartOptions);
//   };

//   const handleThemeChange = (theme: string) => {
//     setSelectedTheme(theme);
//   };

//   const handleClearChartPreview = () => {
//     setClearChartPreview(true);
//     setChartData(null);
//   };

//   useEffect(() => {
//     if (clearChartPreview) {
//       setClearChartPreview(false);
//     }
//   }, [clearChartPreview]);

//   return (
//     <DndProvider backend={HTML5Backend}>
//       <div className="flex flex-col h-[100vh]">
//         {/* AskAITab positioned above the rest */}
//         <div className="bg-white py-0">
//           <AskAITab 
//             dataset={dataset}
//             chartData={chartData}
//             chartType={chartType}
//             selectedTheme={selectedTheme}
//             setChartData={setChartData}
//             onThemeChange={handleThemeChange}
//             onChartCreated={handleChartCreated}
//           />
//         </div>

//         {/* Main content area below AskAITab */}
//         <div className="flex flex-1 overflow-hidden">
//           <ChartSource dataset={dataset} />
//           <div className="flex flex-col flex-1 h-full overflow-y-auto">
//             <div className="flex flex-1">
//               <ChartTabs
//                 dataset={dataset}
//                 chartType={chartType}
//                 onChartCreated={handleChartCreated}
//                 onThemeChange={handleThemeChange}
//                 selectedTheme={selectedTheme}
//                 onClearChartPreview={handleClearChartPreview}
//               />
//               <ChartPreview
//                 dataset={dataset}
//                 chartData={chartData}
//                 chartType={chartType}
//                 selectedTheme={selectedTheme}
//                 setChartData={setChartData}
//                 onThemeChange={handleThemeChange}
//               />
//             </div>
//           </div>
//         </div>
//       </div>
//     </DndProvider>
//   );
// };

// export default ChartsPage;

import React, { useRef, useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ChartSource from './ChartsSource/ChartsSource';
import ChartTabs from './ChartsTabs/ChartsTabs';
import AskAITab from './ChartsTabs/AskAITab';
import ChartPreview from './ChartsPreview/ChartsPreview';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../redux/store';

interface ChartCreateProps {
  dataset: string;
  chartType: string;
}

const ChartsPage: React.FC<ChartCreateProps> = ({ dataset, chartType }) => {
  const [chartData, setChartData] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState('Westeros');
  const [clearChartPreview, setClearChartPreview] = useState(false);
  const chartTabsRef = useRef(null);

  const handleChartCreated = (chartOptions: any) => {
    setChartData(chartOptions);
  };

  const handleThemeChange = (theme: string) => {
    setSelectedTheme(theme);
  };

  const handleClearChartPreview = () => {
    setClearChartPreview(true);
    setChartData(null);
  };

  useEffect(() => {
    if (clearChartPreview) {
      setClearChartPreview(false);
    }
  }, [clearChartPreview]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-[100vh]">
        {/* AskAITab positioned above the rest */}
        <div className="bg-white py-0">
          <AskAITab 
            dataset={dataset}
            chartData={chartData}
            chartType={chartType}
            selectedTheme={selectedTheme}
            setChartData={setChartData}
            onThemeChange={handleThemeChange}
            onChartCreated={handleChartCreated}
          />
        </div>

        {/* Main content area below AskAITab */}
        <div className="flex flex-1 overflow-hidden">
          <ChartSource dataset={dataset} />
          <div className="flex flex-col flex-1 h-full overflow-y-auto">
            <div className="flex flex-1">
              <ChartTabs
                dataset={dataset}
                chartType={chartType}
                onChartCreated={handleChartCreated}
                onThemeChange={handleThemeChange}
                selectedTheme={selectedTheme}
                onClearChartPreview={handleClearChartPreview} 
                database={''}
                schema={''}
                connectionId={''}          
              />
              <ChartPreview
                dataset={dataset}
                chartData={chartData}
                chartType={chartType}
                selectedTheme={selectedTheme}
                setChartData={setChartData}
                onThemeChange={handleThemeChange}
              />
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default ChartsPage;

