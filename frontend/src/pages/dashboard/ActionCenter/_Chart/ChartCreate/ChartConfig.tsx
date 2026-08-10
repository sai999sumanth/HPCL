// import React from 'react';
// import { Card } from '@mui/material';
// import ChartsPage from '../ChartsPage';
// import { ChartCreateProps } from '../../Chart/ChartCreate/ChartCreate';
// import { useLocation } from 'react-router-dom';


// export const ChartConfig: React.FC<ChartCreateProps> = () => {
//   const location = useLocation();
//   const { dataset, chart } = location.state;
//   return (
//     <div className="flex flex-col gap-2">
//       <Card>
//         <div className="p-3">
//           <ChartsPage dataset={dataset} chartType={chart} />
//         </div>
//       </Card>
//     </div>
//   );
// };

// import React from 'react';
// import { Card } from '@mui/material';
// import ChartsPage from '../ChartsPage';
// import { useLocation } from 'react-router-dom';
// interface ChartCreateProps {
//   dataset: string;
//   chartType: string;
// }
// export const ChartConfig: React.FC<ChartCreateProps> = () => {
//   const location = useLocation();
  
//   // Provide default values and use optional chaining
//   const dataset = location.state?.dataset || 'default_dataset';
//   const chart = location.state?.chart || 'default_chart_type';

//   // You might want to log this for debugging
//   console.log('Location state:', location.state);
//   console.log('Dataset:', dataset);
//   console.log('Chart:', chart);

//   return (
//     <div className="flex flex-col gap-2">
//       <Card>
//         <div className="p-3">
//           {dataset && chart ? (
//             <ChartsPage dataset={dataset} chartType={chart} />
//           ) : (
//             <div>Error: Missing required data. Please go back and try again.</div>
//           )}
//         </div>
//       </Card>
//     </div>
//   );
// };

import React from 'react';
import { Card } from '@mui/material';
import ChartsPage from '../ChartsPage';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../../redux/store';

interface ChartCreateProps {
  dataset: string;
  chartType: string;
}

export const ChartConfig: React.FC<ChartCreateProps> = () => {
  const location = useLocation();

  const chartData: any = useSelector((state: RootState) => state.chart);
  
  const dataset = location.state?.dataset || chartData?.chart?.table || 'default_dataset';
  const chart = location.state?.chart || 'default_chart_type';

  console.log('Location state:', location.state);
  console.log('Dataset:', dataset);
  console.log('Chart:', chart);
  console.log("chartData", chartData)

  return (
    <div className="flex flex-col gap-1">
      <Card className="" style={{ boxShadow: 'none' }}> {/* Add shadow */}
        <div className="p-1">
          {dataset && chart ? (
            <ChartsPage dataset={dataset} chartType={chartData} />
          ) : (
            <div>Error: Missing required data. Please go back and try again.</div>
          )}
        </div>
      </Card>
    </div>
  );
};
