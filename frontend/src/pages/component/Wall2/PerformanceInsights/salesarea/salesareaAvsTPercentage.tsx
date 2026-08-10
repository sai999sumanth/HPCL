import React from "react";
import IndividualAvsTPercentage, { IndividualAvsTPercentageProps } from "../IndividualAvsTPercentage";

/** Sales area drill — same as `IndividualAvsTPercentage`, titles use `SalesArea_Name`. */
const SalesAreaAvsTPercentage = (
  props: Pick<IndividualAvsTPercentageProps, "id" | "data" | "selectedYear" | "onRefresh">
) => <IndividualAvsTPercentage {...props} entityKey="SalesArea_Name" />;

export default SalesAreaAvsTPercentage;
