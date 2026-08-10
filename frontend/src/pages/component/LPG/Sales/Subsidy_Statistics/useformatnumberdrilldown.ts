
// Function to format numbers based on drill level
export const formatNumberByDrillLevel = (value, drillLevel) => {
    if (drillLevel === 0) {
      // First level: Show in Crores (Cr)
      return (value / 100000).toFixed(2) + " lakhs";
    } else if (drillLevel === 1) {
      // Second level: Show in Lakhs (L)
      return (value / 100000).toFixed(2) + " lakhs";
    } else {
      // Third level and beyond: Show in Thousands (K)
      return (value / 1000).toFixed(2) + " k";
    }
  };
  import * as am5 from "@amcharts/amcharts5";
  
  export const BRIGHT_COLORS = [
    am5.color("#67b7dc"), 
    am5.color("#6771dc"), 
    ];