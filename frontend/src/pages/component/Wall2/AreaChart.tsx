import React, { memo } from "react";
import { useState, useCallback, useEffect } from "react";
import {
    BarChart,
    Bar,
    LineChart, Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartTooltip,
    Legend,
    ResponsiveContainer,
    LabelList,
    Brush,
    AreaChart, Area,
  } from "recharts";

  interface ActiveStatesCumulative {
    H: boolean;
    A: boolean;
    T: boolean;
    C?: boolean;
    HC: boolean;
    AC: boolean;
  }

  

  const categoryDataCumulative = {
    H: { color: "#74b6dd", name: "history" },
    A: { color: "#fb1c1a", name: "actual" },
    HC: { color: "#2A9D8F", name: "historyCumulative" },
    AC: { color: "#264653", name: "actualCumulative" },
    // T: { color: "#dea600", name: "Target" },
  };

  type ChartMode = "month" | "year" | "ytd" | "date" | "ytm";

 

  const getDataKeyCumulative = (
    key: string,
    mode: ChartMode,
    drillLevel: number
  ): string => {
    switch (key) {
      case "A":
        return "actual";
      case "H":
        return "history";
      case "HC":
        return "historyCumulative";
      case "AC":
        return "actualCumulative";
      default:
        return "";
    }
  };

  

  const CustomTooltipCumulative = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-200 shadow-md rounded-md">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.fill }}>
              {entry.name}: {new Intl.NumberFormat().format(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomXAxisTick: React.FC<any> = ({ x, y, payload }) => {
    const words = payload.value.split(" ");
    const lineHeight = 15;
    // Calculate total height of the text
    const totalHeight = words.length * lineHeight;
    // Calculate maximum width of the text to determine underline width
    const getTextWidth = (text: string, fontSize: number) => {
      const averageCharWidth = fontSize * 0.6; // Approximate width per character
      return text.length * averageCharWidth;
    };
    const maxWidth = Math.max(
      ...words.map((word) => getTextWidth(word, words.length > 9 ? 10 : 12))
    );
  
    return (
      <g transform={`translate(${x},${y})`}>
        {words.map((word: string, index: number) => (
          <g key={index}>
            {/* Text element */}
            <text
              x={0}
              y={index * lineHeight}
              dy={16}
              fill="#1b82f7"
              fontSize={words.length > 9 ? 10 : 12}
              textAnchor="middle"
              dominantBaseline="middle"
              cursor="pointer"
            >
              {word}
            </text>
          </g>
        ))}
      </g>
    );
  };

const AreaChartComponent = ({ data }) => {

    const [mode, setMode] = useState<ChartMode>("ytm");

    const [drillHistory, setDrillHistory] = useState<string[]>(
      mode === "month" ? ["FY 2024-2025"] : []
    );
  
    const [drillLevel, setDrillLevel] = useState(0);

    const [activeStatesCumulative, setActiveStatesCumulative] = useState<ActiveStatesCumulative>({
        A: true,
        H: true,
        T: false,
        C: true,
        HC: true,
        AC: true,
      });
      console.log("data from child", data)
  return (
    <div className="h-[450px] sm:w-sm md:w-md">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        width={500}
        height={300}
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <XAxis
          dataKey="name"
          tick={<CustomXAxisTick />}
          height={60}
          interval={0}
        />
        <YAxis
          tick={{ fill: "#333", fontSize: "0.7rem" }}
          label={{
            value: "",
            angle: -90,
            position: "outsideLeft",
            fill: "#333",
            fontSize: 11,
          }}
          axisLine={{ stroke: "#333" }}
        />
        <CartesianGrid strokeDasharray="3 3" />
        <RechartTooltip
          content={<CustomTooltipCumulative />}
          cursor={{ fill: "#f0f0f0" }}
        />
        <Brush dataKey="name" endIndex={6} height={30} stroke="#8884d8" />
        {Object.entries(categoryDataCumulative).map(
          ([key, { color, name }]) => {
            const dataKey = getDataKeyCumulative(key, mode, drillLevel);
            return (
              activeStatesCumulative[key as keyof ActiveStatesCumulative] && (
                <Area
                  key={key}
                  dataKey={dataKey}
                  name={name}
                  fill={color}
                  color={color}
                  cursor="pointer"
                  type="monotone" stackId="1"
                  alignmentBaseline="before-edge"
                 
                >
                  {/* <LabelList
                    dataKey={dataKey}
                    content={renderCustomizedLabel}
                  /> */}
                </Area>
              )
            );
          }
        )}
      </AreaChart>
    </ResponsiveContainer>
  </div>
  );
};

export default memo(AreaChartComponent);