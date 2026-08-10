import React, { useState } from 'react';
import { Grid } from '@mui/material';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/@/components/ui/tabs';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import { useNavigate } from 'react-router-dom';

import SalesAnalytics from './DryOut Analytics/SalesAnalytics';

const RODryoutAnalytics = () => {
  const [currentTab, setCurrentTab] = useState("domestic");
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      {/* Fixed Header */}
      {/* <div className="fixed w-full top-50px left-0px right-0px z-[1] bg-white shadow-md">
        <div className="px-4 py-2 border-b">
          <Breadcrumb>
            <BreadcrumbList className="flex items-center text-gray-500">
              <BreadcrumbItem>
                <BreadcrumbLink 
                  onClick={() => navigate(-1)} 
                  className="hover:text-gray-700"
                >
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbPage className="text-gray-900">LPG Analytics</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div> */}

      {/* Scrollable Content Area - pushed down by fixed header height */}
      <div className="flex-1 overflow-auto"> 
      <Grid container spacing={1}>
            <SalesAnalytics/>   
      </Grid>
      </div>
    </div>
  );
};

export default RODryoutAnalytics;
