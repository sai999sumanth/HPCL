import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Box,
  Drawer,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import axios from "axios";
import { apiClient } from "@/services/apiClient";

export default function DialogModal(props: any) {
  const [sapData, setSapData] = useState<any>([]);
  const [sapDetails, setSapDetails] = useState<any>({});
  const data = props.props;
  const alertId = props.alert_id;
  const hasFetched = useRef(false);
  console.log("props statusline modal", props)

  const handleClose = () => {
    props.sendDataToParent();
  };

  useEffect(() => {
    if (alertId && !hasFetched.current) {
      hasFetched.current = true; // Mark as called
      fetchData(alertId);
    }
  }, [alertId]);

  const fetchData = async (alertId: any) => {
    try {
      const response = await apiClient.post("/api/indentdryout/get_alert_history", {
        alert_id: alertId.toString(),
      });
      if (response && response.data) {
        console.log("response.data", response.data);
        setSapData(response.data["data"]);
        setSapDetails(response.data["details"]);
      }
      return response;
    } catch (error) {
      throw new Error("Failed to fetch users");
    }
  };

  return (
    <div>
      <Dialog open={true} maxWidth="md" fullWidth>
        {/* <DialogTitle>Title Header</DialogTitle> */}
        <DialogTitle
          sx={{ display: "flex", flexDirection: "column", padding: "10px 25px" }}
        >
          <div className="flex justify-between gap-2">
            <div className="flex flex-col w-96">
              <span className="text-sm font-bold">Location Name:</span>
              <span className="text-sm font-medium text-gray-800">{sapDetails.plant_name}</span>
            </div>
            <div className="flex flex-col w-96">
              <span className="text-sm font-bold">Dealer Name</span> 
              <span className="text-xs font-medium text-gray-800">{sapDetails.name}</span>
            </div>
            <div className="flex flex-col w-96">
              <span className="text-sm font-bold">Zone</span> 
              <span className="text-sm font-medium text-gray-800">{sapDetails.zone}</span>
            </div>
            <div className="flex flex-col w-96">
              <span className="text-sm font-bold">Present Status</span> 
              <span className="text-sm font-medium text-gray-800">{sapDetails.indent_status}</span>
            </div>
            <div className="flex flex-col w-96">
              <span className="text-sm font-bold">Alert ID</span> 
              <span className="text-sm font-medium text-gray-800">{alertId}</span>
            </div>
          </div>
          
          <div className="flex justify-between mt-2">
            <div className="flex flex-col w-96">
              <span className="text-sm font-bold">Location ID</span> 
              <span className="text-xs font-medium text-gray-800">{sapDetails.plant_id}</span>
            </div>
            <div className="flex flex-col w-96">
              <span className="text-sm font-bold">Dealer ID</span> 
              <span className="text-xs font-medium text-gray-800">{sapDetails.sap_id}</span>
            </div>
            <div className="flex flex-col w-96">
              <span className="text-sm font-bold">Indent No</span> 
              <span className="text-xs font-medium text-gray-800">{sapDetails.indent_no}</span>
            </div>
            <div className="flex flex-col w-96">
              <span className="text-sm font-bold">State</span> 
              <span className="text-xs font-medium text-gray-800">{sapDetails.state}</span>
            </div>
            <div className="flex flex-col w-96">
              <span className="text-sm font-bold">Product</span> 
              <span className="text-xs font-medium text-gray-800">{sapDetails.product}</span>
            </div>
          </div>
        </DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0px 25px",
          }}
        >
          {sapData && sapDetails && (
            <Box sx={{ flexGrow: 1, padding: 0, borderRadius: 2 }}>
              <table className="min-w-full table-auto border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "#ccdfee" }}>
                    <th className="border px-4 py-2 text-left">
                      Alert History
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sapData.length > 0 &&
                    sapData.map((item: any, index: number) => (
                      <tr
                        key={index}
                        className="odd:bg-blue-50 even:bg-blue-100"
                      >
                        <td className="border px-4 py-2">{item}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={handleClose}
            sx={{
              backgroundColor: "#81D4FA",
              color: "#FFFFFF",
              "&:hover": { backgroundColor: "#004D40" },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}