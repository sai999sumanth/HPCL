import React from "react";
import IndividualData, { IndividualDataProps } from "../individualData";

/** Region drill — same chart as SBU zone `IndividualData`, title uses `Region_Name`. */
const RegionIndividualData = ({ id, data, onRefresh }: Pick<IndividualDataProps, "id" | "data" | "onRefresh">) => (
  <IndividualData id={id} data={data} onRefresh={onRefresh} entityKey="Region_Name" />
);

export default RegionIndividualData;
