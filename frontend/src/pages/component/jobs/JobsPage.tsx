import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../@/components/ui/select";
import { Input } from "../../../@/components/ui/input";
import { Button } from "../../../@/components/ui/button";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { apiClient } from '@/services/apiClient';

interface Job {
  id: number;
  flow_name: string;
  flow_run_name: string;
  created_at: string;
  updated_at: string;
  job_status: string;
}

const JobsTable: React.FC = () => {  

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobType, setJobType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {  
    fetchJobs(currentPage, searchTerm);
  }, [currentPage, searchTerm, pageSize]);

  const fetchJobs = async (page: number, searchQuery: string = '') => {
    setLoading(true);
    setError(null);
    try { 
      const skip = (page - 1);
      let queryString = '';
      if (searchQuery) { 
        queryString = `flow_name LIKE '%${searchQuery}%' OR flow_run_name LIKE '%${searchQuery}%'`;
      }
      if (jobType !== "all") { 
        queryString += queryString ? ' AND ' : '';
        queryString += `job_status='${jobType}'`;
      }

      const url = `/api/reconexecdetailslog?q=${encodeURIComponent(queryString)}&skip=${skip}&limit=${pageSize}`;
      
      const response = await apiClient.get(url);
      
      if (!response.status) {
        throw new Error('Failed to fetch jobs');
      }
      const result = await response.data;
      setJobs(result.data);
      setTotalItems(result.total || result.data.length);
      setTotalPages(Math.ceil((result.total || result.data.length) / pageSize));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeDifference = (startDate: string, endDate: string): string => {  

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    const milliseconds = diffMs % 1000;

    return `${days}day:${hours}hr:${minutes}min:${seconds}.${milliseconds}sec`;

  };

  const StatusChip: React.FC<{ status: string }> = ({ status }) => {

    const getStatusColor = (status: string) => {

      switch (status.toLowerCase()) { 
        case 'completed':
        case 'success':
          return 'bg-green-500 text-white';
        case 'running':
          return 'bg-blue-500 text-white';
        case 'failed':
          return 'bg-red-500 text-white';
        default:
          return 'bg-gray-500 text-white';
      }


    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
        {status}
      </span>
    );


  };

  const PaginationControls = () => ( 
    <div className="flex items-center justify-between py-4 px-2" >

      <Select
        value={pageSize.toString()}
        onValueChange={(value) => {
          setPageSize(Number(value));
          setCurrentPage(1);
        }}
      >
           <SelectTrigger className="w-[120px]" >
             <SelectValue placeholder="Per page" />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="15" >15 per page</SelectItem>
             <SelectItem value="20" >20 per page</SelectItem>
             <SelectItem value="50" >50 per page</SelectItem>
           </SelectContent>
      </Select>

      <div className="flex items-center space-x-2" >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="mx-2">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

    </div>
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (  
    <div className="p-4" >
      <div className="flex justify-between mb-4" >
        <Input
          placeholder="Search by flow name..."
          value={searchTerm}
          onChange={(e) => { 
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="max-w-sm"
        />
        <div className="flex items-center space-x-2" >
          <Select 
            value={jobType} 
            onValueChange={(value) => {
              setJobType(value);
              setCurrentPage(1);
              fetchJobs(1, searchTerm);
            }}
          >
            <SelectTrigger className="w-[180px]" >
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Running">Running</SelectItem>
              <SelectItem value="Failed">Failed</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => fetchJobs(currentPage, searchTerm)}
            className="bg-[#67037a] text-white hover:bg-[#002D75] hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Table className='rounded-lg'>
        <TableHeader className="bg-[#67037a]">
          <TableRow>
            <TableHead className="text-white">Flow Name</TableHead>
            <TableHead className="text-white">Flow Run Name</TableHead>
            <TableHead className="text-white">Created At</TableHead>
            <TableHead className="text-white">Updated At</TableHead>
            <TableHead className="text-white">Time Consumed</TableHead>
            <TableHead className="text-white">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => ( 
            <TableRow key={job.id}>
              <TableCell className='hover:underline hover:cursor-pointer'>{job.flow_name}</TableCell>
              <TableCell>{job.flow_run_name}</TableCell>
              <TableCell>{new Date(job.created_at).toLocaleString()}</TableCell>
              <TableCell>{new Date(job.updated_at).toLocaleString()}</TableCell>
              <TableCell>{calculateTimeDifference(job.created_at, job.updated_at)}</TableCell>
              <TableCell>
                <StatusChip status={job.job_status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PaginationControls />
    </div>
  );
};

export default JobsTable;