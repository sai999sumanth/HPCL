import { useEffect, useState } from "react";
import axios from "axios";
import { ChartConfig } from "../../_Chart/ChartCreate/ChartConfig";


interface ChartCreateProps {
  dataset: string;
  chartType: string;
}
const ChartContainer = (props: ChartCreateProps) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [chartData, setChartData] = useState([]);

  console.log("props", props);
  
  return (
    <div>
      <h1>
        <ChartConfig dataset={props.dataset} chartType={props.chartType} />
      </h1>
    </div>
  )
}

export default ChartContainer;