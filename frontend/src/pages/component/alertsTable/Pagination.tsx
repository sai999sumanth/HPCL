import React from 'react';
import { ChevronLeft, ChevronRight } from "lucide-react";
  import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "../../../@/components/ui/dropdown-menu";
  import { Button } from "../../../@/components/ui/button";
  import { Input } from "../../../@/components/ui/input";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "../../../@/components/ui/select";
  
interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange
}) => {
  return (
    <div className="flex items-center justify-between py-4 px-2">
      <Select
        value={pageSize.toString()}
        onValueChange={(value) => {
          onPageSizeChange(Number(value));
        }}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Per page" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="15">15 per page</SelectItem>
          <SelectItem value="20">20 per page</SelectItem>
          <SelectItem value="50">50 per page</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
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
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};