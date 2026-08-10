import { useSelector } from "react-redux";
import { RootState } from "../redux/store";

export const useOrganizationId = () => {
    return useSelector((state: RootState) => state.organization.organizationId);
  };