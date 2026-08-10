import React, { useState, useEffect } from 'react';
import { Button } from "../../../../@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../../@/components/ui/dialog";
import { Input } from "../../../../@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../@/components/ui/select";
import { Save, XCircle, PlusCircle } from "lucide-react";
import axios from 'axios';
// import { SaveDashboardData } from '../../../../types/DashbordTypes';

interface Tag {
  name: string;
  value: string;
}

interface Group {
  id: number;
  name: string;
}

interface SaveDashboardData {
  name: string;
  groupId: number;
  groupName: string;
  organizationId: number;
  group_id: number[]; // Matches your implementation
  group_name: string[]; // Matches your implementation
  tags: Tag[];
}

// Tag interface can be more specific
interface Tag {
  name: string;
  value: string;
}

// interface SaveDashboardDialogProps {
//   isOpen: boolean;
//   onOpenChange: (open: boolean) => void;
//   dashboardTitle: string;
//   onSave: (data: any, shouldNavigate: boolean) => void;
//   createdBy: string;
//   initialGroupId?: number;
//   initialGroupName?: string;
// }

interface SaveDashboardDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardTitle: string;
  onSave: (data: SaveDashboardData, shouldNavigate: boolean) => void;
  createdBy: string;
  initialGroupId?: number;
  initialGroupName?: string;
  organizationId: number;
}
const SaveDashboardDialog: React.FC<SaveDashboardDialogProps> = ({
  isOpen,
  onOpenChange,
  dashboardTitle,
  onSave,
  createdBy,
  initialGroupId,
  initialGroupName,
  organizationId,
}) => {
  const [chartName, setChartName] = useState(dashboardTitle);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId );
  const [selectedGroupName, setSelectedGroupName] = useState(initialGroupName );
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);


  // Update form when dialog opens or initialGroupName changes
  useEffect(() => {
    if (isOpen) {
      setChartName(dashboardTitle);
      setSelectedGroupId(initialGroupId );
      setSelectedGroupName(initialGroupName );
      setTags([]);
      setError(null);
    }
  }, [isOpen, dashboardTitle, initialGroupId, initialGroupName]);

  const addTag = () => {
    setTags([...tags, { name: "", value: "" }]);
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const updateTag = (index: number, field: 'name' | 'value', value: string) => {
    const newTags = [...tags];
    newTags[index][field] = value;
    setTags(newTags);
  };

  // const handleConfirmSave = () => {
  //   if (!chartName.trim()) {
  //     setError("Dashboard name is required");
  //     return;
  //   }

  //   const validTags = tags.filter(tag => tag.name.trim() && tag.value.trim());

  //   onSave({
  //     name: chartName.trim(),
  //     group: selectedGroup.trim(),
  //     tags: validTags,
  //   });
  //   onOpenChange(false);
  // };

  // const handleConfirmSave = (shouldNavigate: boolean) => {
  //   if (!chartName.trim()) {
  //     setError("Dashboard name is required");
  //     return;
  //   }

  //   const validTags = tags.filter(tag => tag.name.trim() && tag.value.trim());

  //   onSave({
  //     name: chartName.trim(),
  //     groupId: selectedGroupId,
  //     groupName: selectedGroupName,
  //     organizationId,
  //     group_id: [selectedGroupId]||[],
  //     group_name: [selectedGroupName]||[],
  //     tags: validTags,
  //   }, shouldNavigate);
    
  //   onOpenChange(false);
  // };
  const handleConfirmSave = (shouldNavigate: boolean) => {
    if (!chartName.trim()) {
      setError("Dashboard name is required");
      return;
    }
  
    const validTags = tags.filter(tag => tag.name.trim() && tag.value.trim());
  
    onSave({
      name: chartName.trim(),
      groupId: selectedGroupId,
      groupName: selectedGroupName,
      organizationId,
      group_id: [selectedGroupId], // Direct array format
      group_name: [selectedGroupName], // Direct array format
      tags: validTags,
    }, shouldNavigate);
    
    onOpenChange(false);
  };
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {dashboardTitle ? 'Update dashboard' : 'Save dashboard'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-2">
            <label htmlFor="name" className="font-medium text-sm">
              DASHBOARD NAME *
            </label>
            <Input
              id="name"
              value={chartName}
              onChange={(e) => setChartName(e.target.value)}
              className="w-full"
              placeholder="Enter dashboard name"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            <label className="font-medium text-sm">
              GROUP
            </label>
            <Input
              value={selectedGroupName}
              onChange={(e) => {
                setSelectedGroupName(e.target.value);
                // Generate a simple numeric ID if needed
                if (!selectedGroupId) {
                  setSelectedGroupId(Date.now());
                }
              }}
              placeholder="Enter group name"
              className="w-full"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <label htmlFor="createdBy" className="font-medium text-sm">
              CREATED BY
            </label>
            <Input
              id="createdBy"
              value={createdBy}
              readOnly
              className="w-full bg-gray-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <label htmlFor="tags" className="font-medium text-sm">
              TAGS
            </label>
            {tags.map((tag, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={tag.name}
                  placeholder="Tag name"
                  onChange={(e) => updateTag(index, 'name', e.target.value)}
                  className="w-1/2"
                />
                <Input
                  value={tag.value}
                  placeholder="Tag value"
                  onChange={(e) => updateTag(index, 'value', e.target.value)}
                  className="w-1/2"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="p-2"
                  onClick={() => removeTag(index)}
                  title="Remove tag"
                >
                  <XCircle className="w-4 h-4 text-black-600" />
                </Button>
              </div>
            ))}
            <Button 
              onClick={addTag} 
              className="mt-2 text-black flex items-center hover:bg-gray-100"
              title="Add new tag"
            >
              <PlusCircle className="mr-1 w-4 h-4" /> Add tag
            </Button>
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="hover:bg-gray-100"
          >
            CANCEL
          </Button>
          <Button
            onClick={() => handleConfirmSave(false)}
            className="bg-[#0047AB] hover:bg-[#0047AB]/90 text-white"
            disabled={!chartName.trim()}
          >
            {dashboardTitle ? 'UPDATE' : 'SAVE'}
          </Button>
          <Button
            onClick={() => handleConfirmSave(true)}
            className="bg-[#0047AB] hover:bg-[#0047AB]/90 text-white"
            disabled={!chartName.trim()}
          >
            {dashboardTitle ? 'UPDATE& GO TO GROUPS':'SAVE& GO TO GROUPS'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveDashboardDialog;