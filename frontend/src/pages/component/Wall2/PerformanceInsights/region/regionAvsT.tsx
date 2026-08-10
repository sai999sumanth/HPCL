import React from "react";
import IndividualAvsT, { IndividualAvsTProps } from "../IndividualAvsT";

/** Region drill — same as SBU `IndividualAvsT`, titles use `Region_Name`. */
const RegionAvsT = (props: Pick<IndividualAvsTProps, "id" | "data" | "onRefresh">) => (
  <IndividualAvsT {...props} entityKey="Region_Name" />
);

export default RegionAvsT;
