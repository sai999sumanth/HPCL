import React, { useState } from 'react';
import { Undo2, Redo2, Plus, Save, Video, Monitor, Settings } from 'lucide-react';
import { useLayoutStore } from '@/redux/features/useLayoutStore';
import { Button } from '@/@/components/ui/button';
import { Groups } from '@/types/groups';
import { toast } from '@/@/components/ui/use-toast';
import { Label } from '@/@/components/ui/label';
import { Input } from '@/@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/@/components/ui/dialog';
import axios from 'axios';
import { apiClient } from '@/services/apiClient';

interface ToolBar  {
  groups: Groups[];
};

export const ToolBar: React.FC<ToolBar> = (props) => {
  const { undo, redo, layout, openModal, openScreenSaveModal, isSaveScreenPopupOpen } = useLayoutStore();
  const [screenName, setScreenName] = useState("");
  const [customScreenName, setCustomScreenName] = useState("");
  const { groups } = props;

  console.log("props", props);


  const handleSaveScreen = async () => {
    console.log(JSON.stringify(layout, null, 2));
  
    // Find matching records
    const matchingRecords = groups
      .filter(item1 => new Set(layout.map(item2 => item2.i)).has(item1.id.toString()))
      .map(ele => ({
        ...ele,
        group_id: ele.id,
      }));
  
    const params = {
      screen_title: screenName || customScreenName,
      groups: [],
      changed_by: "Sakariya Anthony",
      created_by: "Sakariya Anthony",
      created_user: "",
      organization_id: 0,
      groups_data: matchingRecords,
      layout: layout,
    };
  
    try {
      const response = await apiClient.post("/api/screens/create_screens", params);
  
      if (response.data?.status) {
        console.log("Screen saved successfully");
        toast({
          variant: "default",
          title: "Screen",
          description: "Screen saved successfully",
        });
      } else {
        console.error("Failed to save screen");
      }
    } catch (error) {
      console.error("Error saving screen:", error);
    }
  };
  

  return (
    <React.Fragment>
      <div className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            onClick={undo}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Undo"
            variant="outline"
          >
            <Undo2 className="w-5 h-5" />
          </Button>
          <Button
            onClick={redo}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Redo"
            variant="outline"
          >
            <Redo2 className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="icon"
            size='icon'
            onClick={() => openModal(true)}
            className="bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="default"
            onClick={() => console.log(layout)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
          <Monitor className="w-4 h-4 mr-2" /> New Screen 
          </Button>
          <Button
            variant="default"
            onClick={() => openScreenSaveModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" /> Save Screen 
          </Button>
        </div>
      </div>


      <Dialog open={isSaveScreenPopupOpen} onOpenChange={useLayoutStore.getState().openScreenSaveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter your screen name</DialogTitle>
            <DialogDescription>Select or  your screen name</DialogDescription>
          </DialogHeader>
          <div className="w-full space-y-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="screen-name">Screen Name</Label>
              <Select defaultValue="lpg" value={screenName} onValueChange={setScreenName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lpg">LPG</SelectItem>
                  <SelectItem value="tas">TAS</SelectItem>
                  <SelectItem value="gas">Gas</SelectItem>
                  <SelectItem value="custom">Custom name</SelectItem>
                </SelectContent>
              </Select>
            </div>
            { screenName === "custom" &&
              <div className="flex flex-col gap-2">
                <Label htmlFor="screen-name">Screen Name</Label>
                <Input id="screen-name" value={customScreenName} onChange={(e) => setCustomScreenName(e.target.value)} placeholder="Enter your screen name" />
              </div>
            }
          </div>
          <DialogFooter className="sm:justify-start">
            <DialogClose asChild>
              <Button type="button" variant="secondary" onClick={handleSaveScreen}>
                Save Screen
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button type="button" variant="destructive">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </React.Fragment>
  );
};