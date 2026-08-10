import React from "react";
import IndividualDataPercentage, { IndividualDataPercentageProps } from "../individualDataPercentage";

/** Region drill — same as SBU `IndividualDataPercentage`, titles use `Region_Name`. */
const RegionIndividualDataPercentage = (
  props: Pick<IndividualDataPercentageProps, "id" | "data" | "selectedYear" | "onRefresh">
) => <IndividualDataPercentage {...props} entityKey="Region_Name" />;

export default RegionIndividualDataPercentage;
