import React from "react";
import IndividualDataPercentage, { IndividualDataPercentageProps } from "../individualDataPercentage";

/** Sales area drill — same as `IndividualDataPercentage`, titles use `SalesArea_Name`. */
const SalesAreaIndividualDataPercentage = (
  props: Pick<IndividualDataPercentageProps, "id" | "data" | "selectedYear" | "onRefresh">
) => <IndividualDataPercentage {...props} entityKey="SalesArea_Name" />;

export default SalesAreaIndividualDataPercentage;
