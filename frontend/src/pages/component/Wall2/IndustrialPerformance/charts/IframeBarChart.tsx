import React from "react";

const HPCLDrilldown: React.FC = () => {
  return (
    <div style={{ margin: 0, padding: 0, overflow: "hidden", height: "300px", width: "100vw" }}>
      <iframe 
        src="https://julius.ai/files/hpcl_drilldown_fixed.html" 
        allowFullScreen 
        style={{ width: "100%", height: "100%", border: "none" }}
        title="HPCL Sales Drill-Down Chart"
      />
    </div>
  );
};

export default HPCLDrilldown;
