import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../../@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../@/components/ui/table";

// Dummy data for the second tab
const dummyData = [
  {
    id: "1",
    project: "Project Alpha",
    status: "Active",
    lastUpdated: "2024-10-15",
    owner: "John Doe",
    priority: "High",
    progress: "75%"
  },
  {
    id: "2",
    project: "Project Beta",
    status: "On Hold",
    lastUpdated: "2024-10-14",
    owner: "Jane Smith",
    priority: "Medium",
    progress: "45%"
  },
  {
    id: "3",
    project: "Project Gamma",
    status: "Completed",
    lastUpdated: "2024-10-13",
    owner: "Mike Johnson",
    priority: "Low",
    progress: "100%"
  },
  {
    id: "4",
    project: "Project Delta",
    status: "Active",
    lastUpdated: "2024-10-12",
    owner: "Sarah Wilson",
    priority: "High",
    progress: "30%"
  }
];

// Dummy table component
const DummyTable = () => (
  <div className="w-full p-1 bg-white rounded-lg">
    <Table>
      <TableHeader className="bg-[#0047AB]">
        <TableRow>
          <TableHead className="text-white">Project</TableHead>
          <TableHead className="text-white">Status</TableHead>
          <TableHead className="text-white">Last Updated</TableHead>
          <TableHead className="text-white">Owner</TableHead>
          <TableHead className="text-white">Priority</TableHead>
          <TableHead className="text-white">Progress</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dummyData.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.project}</TableCell>
            <TableCell>
              <span className={`px-2 py-1 rounded-full text-sm ${
                row.status === 'Active' ? 'bg-green-100 text-green-800' :
                row.status === 'On Hold' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {row.status}
              </span>
            </TableCell>
            <TableCell>{row.lastUpdated}</TableCell>
            <TableCell>{row.owner}</TableCell>
            <TableCell>
              <span className={`px-2 py-1 rounded-full text-sm ${
                row.priority === 'High' ? 'bg-red-100 text-red-800' :
                row.priority === 'Medium' ? 'bg-orange-100 text-orange-800' :
                'bg-green-100 text-green-800'
              }`}>
                {row.priority}
              </span>
            </TableCell>
            <TableCell>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: row.progress }}
                ></div>
              </div>
              <span className="text-sm text-gray-600 ml-2">{row.progress}</span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

// Main component with tabs
const TabbedAlertsView = ({ AlertsTable }) => {
  const [activeTab, setActiveTab] = useState("alerts");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-[400px] grid-cols-2 mb-4">
        <TabsTrigger 
          value="alerts"
          className={activeTab === "alerts" ? "bg-[#0047AB] text-white" : ""}
        >
          Alerts
        </TabsTrigger>
        <TabsTrigger 
          value="projects"
          className={activeTab === "projects" ? "bg-[#0047AB] text-white" : ""}
        >
          Projects
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="alerts">
        <AlertsTable />
      </TabsContent>
      
      <TabsContent value="projects">
        <DummyTable />
      </TabsContent>
    </Tabs>
  );
};

export default TabbedAlertsView;