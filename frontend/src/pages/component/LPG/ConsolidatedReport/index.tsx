import React from 'react';

import sampleData from "./sampleData.json"; // your API response
import ConsolidatedPlantReport from './ConsolidatedReport';

const LPGPlantwiseReport: React.FC = () => {
  

  return (
 <div style={{ height: "90vh", width: "100%" }}>
        <ConsolidatedPlantReport/>


  
    </div>
  );
};

export default LPGPlantwiseReport;
