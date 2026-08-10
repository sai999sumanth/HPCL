import React, { useState } from 'react';
import { Tooltip } from "@mui/material";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from "@/@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/@/components/ui/table";
import { fetchChartData } from '../api';
import { Loader2 } from 'lucide-react';

interface GrowthCardProps {
  title: string;
  currentValue: number;
  historicalValue: number;
  dateType?: string;
  dateValue?:string;
  headerTitle?: string;
  bgColor?: string;
  additionalData?: any;
}

const GrowthStatCard = ({
  title,
  currentValue,
  historicalValue,
  dateType,
  dateValue,
  headerTitle,
  bgColor = "bg-emerald-50",
  additionalData = [] // New prop for additional detailed data
}: GrowthCardProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const productLevelForYTD = async () => {
    setIsLoading(true);
    let dateFilters = []; let crossFilters = [];
    if(dateType === '"DATE"') {
      dateFilters = [{ "key": "\"C\"", "cond": "equals", "value": "true" }, { "key": "\"YTD\"", "cond": "equals", "value": "true" }]
    }
    if(dateType !== '"DATE"') {
      crossFilters = [{ key: '"month_name"', cond: "equals", value: "", }]
    }
    let payload = {
      filters: [
        { key: '"A"', cond: "equals", value: "true", },
        { key: '"H"', cond: "equals", value: "true", },
        { key: dateType, cond: "equals", value: dateValue, },
        { key: '"SBU_Name"', cond: "equals", value: title, },
        ...dateFilters
      ],
      cross_filters: [
        { key: '"SBU_Name"', cond: "equals", value: title, },
        ...crossFilters
      ],
      action: "m60_performance",
      drill_state: "",
    };
    

    try {
      const response = await fetchChartData(payload);
      if(response.status) {
        setIsLoading(false);
        console.log(response.data);
        const { data } = response.data;
        setTableData(() => Object.keys(data.ProductName).map((key) => ({
          productName: data.ProductName[key],
          actualTmtSales: data.ACTUAL_TMT_SALES[key],
          actualHistoryTmtSales: data.ACTUAL_HISTORY_TMT_SALES[key]
        })).filter(item => item.actualTmtSales > 0 || item.actualHistoryTmtSales > 0))
      } 
    } catch {
      console.warn("error");
      setIsLoading(false);
    }
  };
  
  const openDialogBox = () => {
    productLevelForYTD();
    setIsDialogOpen(true);
  }

  const getStyles = (value) => {
    if (value > 0) {
      return {
        background: "bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200",
        glow: "before:bg-emerald-500/20",
        text: "text-black",
        gradientText: "bg-gradient-to-r from-emerald-500 to-green-600",
        border: "border-emerald-200/30",
        highlight: "group-hover:text-emerald-500",
        icon: "bg-emerald-500",
      };
    } else {
      return {
        background: "bg-gradient-to-br from-red-50 via-red-100 to-red-200",
        glow: "before:bg-red-500/20",
        text: "text-black",
        gradientText: "bg-gradient-to-r from-red-500 to-rose-600",
        border: "border-red-200/30",
        highlight: "group-hover:text-red-500",
        icon: "bg-red-500",
      };
    }
  };

  const calculatePercentage = (currentValue, historicalValue) => {
    // If both values are 0 → return 0%
    if (Math.round(currentValue) === 0 && Math.round(historicalValue) === 0) return 0;
  
    // If historical value is 0 and current is not → treat as 100%
    if (historicalValue === 0) return 100;
  
    // Normal calculation
    let percentage = ((currentValue - historicalValue) / historicalValue) * 100;
  
    // Clamp between -100 and 100
    // if (percentage > 100) percentage = 100;
    // if (percentage < -100) percentage = -100;
  
    return Number(percentage.toFixed(2));
  };

  const percentageNum = calculatePercentage(currentValue, historicalValue);
  const styles = getStyles(percentageNum);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <div // onClick={() => openDialogBox()}        
        className={`group relative rounded-xl font-['verdana'] ${styles.background} border ${styles.border} backdrop-blur-xl transition-all duration-300 hover:scale-[1.02]`}
      >
        {/* Card Content */}
        <div className="relative p-1.5">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h3 className="text-[.75em] font-bold text-[#111] uppercase tracking-wider">
                {title}
              </h3>
            </div>
          </div>
          
          <div
            className={`py-0 flex rounded-xl mt-0 border-none`}
          > {/* ${styles.background} */}
            <span className={`text-[18px] font-extrabold ${styles.text}`}>
              {percentageNum.toFixed(1)}%
            </span>
          </div>

          {/* Stats Grid */}
          <div
            className="grid grid-cols-2 gap-4 mt-auto"
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            <div className="space-y-0">
              <p className="text-[13px] text-gray-800 font-medium">Curr</p>
              <Tooltip title={currentValue} placement="top">
                <p className="text-[13px] font-bold text-black">
                  {Number(Math.round(currentValue)).toLocaleString()}
                </p>
              </Tooltip>
            </div>
            <div className="space-y-0">
              <p className="text-[13px] text-gray-800 font-medium m-0">Hist</p>
              <Tooltip title={historicalValue} placement="top">
                <p className="text-[13px] font-bold text-black m-0">
                  {Number(Math.round(historicalValue)).toLocaleString()}
                </p>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Popup Dialog */}
      <DialogContent className="sm:max-w-[800px] p-3">
        <DialogHeader>
          <DialogTitle className='flex  gap-3'>
            <div className='flex items-center justify-center'>{title} Product Details -</div> 
            <span className="bg-gray-200 px-2 py-1 rounded-sm text-xs">{headerTitle}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4 h-[400px]">
          {/* <ScrollArea className="h-[400px] w-full border rounded-md"> */}
          {isLoading ? (
            <div className="flex justify-center items-center h-[400px]">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10 bg-gray-200">
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Current Sales (TMT)</TableHead>
                  <TableHead>Historical Sales (TMT)</TableHead>
                  <TableHead>Change (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((item, index) => {
                  const changePercentage = calculatePercentage(
                    item.actualTmtSales, 
                    item.actualHistoryTmtSales
                  );
                  
                  return (
                    <TableRow key={index}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.actualTmtSales.toLocaleString()}</TableCell>
                      <TableCell>{item.actualHistoryTmtSales.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={
                          changePercentage > 0 
                            ? "text-green-600" 
                            : changePercentage < 0 
                              ? "text-red-600" 
                              : ""
                        }>
                          {changePercentage.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {/* </ScrollArea> */}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GrowthStatCard;