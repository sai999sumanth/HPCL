import React from "react";
import IndividualAvsT, { IndividualAvsTProps } from "../IndividualAvsT";

/** Sales area drill — same as `IndividualAvsT`, titles use `SalesArea_Name`. */
const SalesAreaAvsT = (props: Pick<IndividualAvsTProps, "id" | "data" | "onRefresh">) => (
  <IndividualAvsT {...props} entityKey="SalesArea_Name" />
);

export default SalesAreaAvsT;
