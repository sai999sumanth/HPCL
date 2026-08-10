import { combineReducers } from '@reduxjs/toolkit';
import appReducer from '../features/appStateSlice';
import formDataReducer from '../features/formStateSlice';
import dropdownReducer from '../features/dropdownSlice';
import tableDataReducer from '../features/tableDataSlice';
import connectionReducer from '../features/connectionSlice';
import nodeStatusReducer from '../features/nodeStatusSlice';
import getFilterReducer from '../features/getFilterSlice';
import eachFormValueReducer from '../features/eachFormValue';
import FormCategoryReducer from '../features/formCategorySlice';
import fetchNodeFromApiReducer from '../features/fetchNodeFromApiSlice';
import costExpSlice from "../features/costExpSlice";
import reportsSlice from "../features/reportsSlice";
import chartSlice from "../features/chartSlice";
import pieReducer from '../features/pieSlice';
import askaiReducer from '../features/askAISlice';
import dashboardReducer from '../features/dashboardSlice';
import organizationReducer from '../features/organizationSlice';
import sidebarReducer from '../features/sidebarSlice';


const rootReducer = combineReducers({
  app: appReducer, // Ensure this matches the key used in the useSelector
  formdata: formDataReducer,
  dropdown: dropdownReducer,
  tabledata: tableDataReducer,
  connection: connectionReducer,
  nodeStatus: nodeStatusReducer,
  getFilter: getFilterReducer,
  eachFormValue: eachFormValueReducer,
  formCategory: FormCategoryReducer,
  fetchNodeFromApi: fetchNodeFromApiReducer,
  chart:chartSlice,
  pie:pieReducer,
  askai: askaiReducer,
  dashboard: dashboardReducer,
  organization:organizationReducer,
  sidebar: sidebarReducer,
  

});

export default rootReducer;
