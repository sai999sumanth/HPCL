import React from "react";
import BarChart from "@/components/widgets/bar/BarChart";

function transformData(apiResponse: any) {
  if (apiResponse.length === 0) return { transformedData: [], yAxesFields: [] };
  // Dynamically find the first field that is used as category (assume it's the first non-numeric field or based on a pattern)
  const getXaxisField = (data: any[]) => {
    for (const key in data[0]) {
      if (data[0].hasOwnProperty(key)) {
        const value = data[0][key];
        if (isNaN(value)) {
          // Return the first non-numeric field as the category (X-axis)
          return key;
        }
      }
    }
    return ""; // Default to empty string if no non-numeric field found
  };

  const xAxisField = getXaxisField(apiResponse); // Get X-axis field dynamically

  // Dynamically get y-axis fields (fields other than xAxisField)
  const yAxesFields = Object.keys(apiResponse[0])
    .filter((key) => key !== xAxisField) // Exclude the x-axis field (category)
    .map((key) => ({ label: key, field: key })); // Return each field with label and field properties

  // Transform the data based on the y-axis fields
  const transformedData = apiResponse.map((item: any) => {
    let row: any = {
      category: item[xAxisField], // Set the x-axis (category) value
    };

    // Add y-axis fields dynamically, checking type for each field
    yAxesFields.forEach(({ field, label }) => {
      const value = item[field];
      if (typeof value === "number" || !isNaN(parseFloat(value))) {
        row[label] = parseFloat(value) || 0; // If it's a number, convert it
      } else {
        row[label] = value; // Otherwise, keep it as string or text
      }
    });

    return row;
  });

  return { transformedData, yAxesFields, xAxisField }; // Return both transformed data, yAxisFields, and xAxisField
}

const AiChartComponent = ({ aiResults = [], title = "" }) => {
  const { transformedData = [], yAxesFields = [] } = transformData(aiResults);
  return (
    <BarChart
      containerId="basic-bar-chart"
      chartData={transformedData}
      xAxisField="category"
      yAxisFields={yAxesFields}
      enableDrillDown={false}
      title={title}
    />
  );
};
export default AiChartComponent;
