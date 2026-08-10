import React from "react";
import IndividualData, { IndividualDataProps } from "../individualData";

/** Sales area drill — same chart as `IndividualData`, title uses `SalesArea_Name`. */
const SalesAreaIndividualData = ({ id, data, onRefresh }: Pick<IndividualDataProps, "id" | "data" | "onRefresh">) => (
  <IndividualData id={id} data={data} onRefresh={onRefresh} entityKey="SalesArea_Name" />
);

export default SalesAreaIndividualData;
