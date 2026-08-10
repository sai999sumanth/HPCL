import React from "react";
import IndividualAvsTPercentage, { IndividualAvsTPercentageProps } from "../IndividualAvsTPercentage";

/** Region drill — same as SBU `IndividualAvsTPercentage`, titles use `Region_Name`. */
const RegionAvsTPercentage = (
  props: Pick<IndividualAvsTPercentageProps, "id" | "data" | "selectedYear" | "onRefresh">
) => <IndividualAvsTPercentage {...props} entityKey="Region_Name" />;

export default RegionAvsTPercentage;
